import type { ApiErrorBody } from "../types/marketplace";

// Browser client for /api/v1/marketplace (same origin, Better Auth cookie).

export const API_BASE = "/api/v1/marketplace";

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; message: string };

export async function api<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const isFile = body instanceof Blob;
    const response = await fetch(API_BASE + path, {
      method,
      credentials: "same-origin",
      headers:
        body === undefined
          ? undefined
          : {
              "Content-Type": isFile
                ? body.type || "application/octet-stream"
                : "application/json",
            },
      body:
        body === undefined ? undefined : isFile ? body : JSON.stringify(body),
    });
    const json: unknown = await response.json().catch(() => null);
    if (response.ok)
      return {
        ok: true,
        status: response.status,
        data: (json as { data: T }).data,
      };
    const error = (json as ApiErrorBody | null)?.error;
    return {
      ok: false,
      status: response.status,
      code: error?.code ?? "UNAVAILABLE",
      message: error?.message ?? "",
    };
  } catch {
    return { ok: false, status: 0, code: "UNAVAILABLE", message: "" };
  }
}

const TEXTS: Record<string, string> = {
  VALIDATION_ERROR: "Please check your input.",
  UNAUTHENTICATED: "Your session has ended. Please sign in again.",
  FORBIDDEN: "You are not allowed to do this.",
  SELLER_EXISTS: "You already have a shop.",
  SELLER_NOT_ALLOWED: "Your shop cannot be changed or list products right now.",
  OFFER_LOCKED: "This product cannot be changed any more.",
  SELLER_NOT_FOUND: "This item does not exist any more.",
  OFFER_NOT_FOUND: "This item does not exist any more.",
  SALE_NOT_FOUND: "This item does not exist any more.",
  IMAGE_TOO_LARGE: "An image is larger than 5 MB. Please choose a smaller one.",
  INVALID_IMAGE: "Please upload JPG, PNG or WEBP images only.",
  ACCOUNTING_UNAVAILABLE:
    "Accounting is not available. The sale stays waiting; please try again later.",
  INVOICE_REFUSED:
    "Accounting refused this sale. Please check the sale with Accounting.",
  ALREADY_INVOICED: "This sale is already booked. Please reload the page.",
  CONCURRENT_UPDATE: "Something changed at the same time. Please try again.",
};

/** The user-facing text for a failed request (UI spec §5): starts with "Error:". */
export function errorText(result: { code: string; status: number }) {
  const text =
    TEXTS[result.code] ??
    "The marketplace service is not available. Please try again later.";
  return `Error: ${text}`;
}
