export const errorTexts: Record<string, string> = {
  SHIPMENT_NOT_FOUND: "Shipment not found. Please check the ID.",
  ORDER_ALREADY_HAS_SHIPMENT:
    "This order already has a shipment. Search by Order ID to find it.",
  INVALID_TRANSITION:
    "This status change is not allowed. No intermediate reports were added.",
  STALE_EVENT:
    "This report is older than the latest update. Check the reported time.",
  VALIDATION_ERROR:
    "The API rejected these values. Check the fields and formats.",
  UNAUTHENTICATED: "Please sign in again.",
  FORBIDDEN: "You do not have permission to use Logistics.",
  SERVICE_UNAVAILABLE:
    "The Logistics service is unavailable. Please try again.",
};
export async function logisticsRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/logistics/shipments${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new Error(errorTexts.SERVICE_UNAVAILABLE);
  }
  const body = await response.json();
  if (!response.ok) {
    const e = body.error ?? { code: "HTTP_ERROR", message: "" };
    throw new Error(
      `${errorTexts[e.code] ?? "The Logistics request failed. Please try again."} (${e.code}: ${e.message})`,
    );
  }
  return body as T;
}
