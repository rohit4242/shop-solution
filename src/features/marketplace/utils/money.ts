// Money is integer cents, VAT included (README "Conventions").

const PRICE = /^\d+([.,]\d{1,2})?$/;

/** "24.90", "24,9" or "24" → 2490. Null when the text is not a price. */
export function parsePriceMinor(text: string): number | null {
  const value = text.trim();
  if (!PRICE.test(value)) return null;
  const [euros, cents = ""] = value.replace(",", ".").split(".");
  return Number(euros) * 100 + Number(cents.padEnd(2, "0"));
}

/** 2490 → "24.90" (for inputs). */
export const priceText = (minor: number) => (minor / 100).toFixed(2);

/** 2490 → "24.90 EUR" (for display). */
export const formatMoney = (minor: number, currency = "EUR") =>
  `${priceText(minor)} ${currency}`;

/** "5" → 5. Null unless a whole number 0 or more. */
export function parseStock(text: string): number | null {
  const value = text.trim();
  return /^\d+$/.test(value) ? Number(value) : null;
}
