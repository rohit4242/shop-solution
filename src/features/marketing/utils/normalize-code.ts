// Codes are stored in uppercase, so the unique constraint on `code` is case-insensitive.
// Every write must go through this function.
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}
