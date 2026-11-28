import "server-only";

/** A domain error with its HTTP status and stable code (README "Errors"). */
export class MarketplaceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "MarketplaceError";
  }
}

export const invalid = (
  message: string,
  fieldErrors?: Record<string, string[]>,
) => new MarketplaceError(400, "VALIDATION_ERROR", message, fieldErrors);
export const unauthenticated = () =>
  new MarketplaceError(401, "UNAUTHENTICATED", "Sign in to continue.");
export const forbidden = (message: string) =>
  new MarketplaceError(403, "FORBIDDEN", message);
export const notFound = (code: string, message: string) =>
  new MarketplaceError(404, code, message);
export const conflict = (code: string, message: string) =>
  new MarketplaceError(409, code, message);
