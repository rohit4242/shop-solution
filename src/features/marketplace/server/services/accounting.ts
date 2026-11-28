import "server-only";
import type { SaleLine } from "../../types/marketplace";

// Client for Accounting's commission invoices (cross-module flow, Accounting API 1.2.0).
// Marketplace sends the sale; Accounting calculates and books the commission.

export type HandoffResult =
  | { invoiceStatus: "invoiced"; invoiceId: string; invoiceError: null }
  | { invoiceStatus: "refused"; invoiceId: null; invoiceError: string }
  | {
      invoiceStatus: "pending";
      invoiceId: null;
      invoiceError: string;
      unreachable: true;
    };

const TIMEOUT_MS = 3_000;

const pending = (invoiceError: string): HandoffResult => ({
  invoiceStatus: "pending",
  invoiceId: null,
  invoiceError,
  unreachable: true,
});

/** Never throws: an unreachable Accounting leaves the line pending for a retry. */
export async function sendToAccounting(line: SaleLine): Promise<HandoffResult> {
  const base = process.env.MARKETPLACE_ACCOUNTING_API_URL?.trim();
  if (!base)
    return pending(
      "Accounting is not configured (MARKETPLACE_ACCOUNTING_API_URL).",
    );
  const token = process.env.MARKETPLACE_ACCOUNTING_API_TOKEN?.trim();
  let response: Response;
  try {
    response = await fetch(
      new URL("commission-invoices", base.endsWith("/") ? base : base + "/"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          saleId: line.saleId,
          orderId: line.orderId,
          sellerId: line.sellerId,
          offerId: line.offerId,
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
          grossMinor: line.grossMinor,
          currency: line.currency,
          soldAt: line.soldAt,
        }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
  } catch {
    return pending("Accounting could not be reached.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const invoiceId =
      readString(body, "invoiceId") ??
      readString(readObject(body, "data"), "invoiceId");
    return invoiceId
      ? { invoiceStatus: "invoiced", invoiceId, invoiceError: null }
      : pending("Accounting answered without an invoice ID.");
  }
  if (
    response.status === 409 ||
    response.status === 422 ||
    response.status === 400
  ) {
    const error = readObject(body, "error");
    const code = readString(error, "code");
    const message = readString(error, "message");
    return {
      invoiceStatus: "refused",
      invoiceId: null,
      invoiceError:
        code && message ? `${code}: ${message}` : `HTTP ${response.status}`,
    };
  }
  return pending(`Accounting answered HTTP ${response.status}.`);
}

function readObject(value: unknown, key: string): unknown {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : undefined;
}
function readString(value: unknown, key: string): string | undefined {
  const field = readObject(value, key);
  return typeof field === "string" && field.length > 0
    ? field.slice(0, 300)
    : undefined;
}
