import Decimal from "decimal.js";

// Agreed with CRM: money crosses module boundaries as a decimal with 2 places plus a currency,
// e.g. { "total": 59.90, "currency": "EUR" }. Inside our code it is always a Decimal, never a
// JS number, so 0.1 + 0.2 stays 0.3. Round half up to 2 places, per item, before summing.

export type Money = Decimal;

export function money(value: Decimal.Value): Money {
  return new Decimal(value);
}

export function round2(value: Decimal.Value): Money {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** percent is e.g. 10 for 10 %. Result is rounded to 2 places. */
export function percentOf(
  amount: Decimal.Value,
  percent: Decimal.Value,
): Money {
  return round2(new Decimal(amount).mul(percent).div(100));
}

export function sum(values: Decimal.Value[]): Money {
  return values.reduce<Money>((acc, v) => acc.add(v), new Decimal(0));
}

/** For JSON responses: a number with exactly 2 decimal places. */
export function toJson(value: Decimal.Value): number {
  return round2(value).toNumber();
}

// The shared shop database stores money as integer minor units (cents) and percentages as basis points
// (prisma/README.md). Our wire format stays a decimal with 2 places (59.90, 10), so these are the only
// conversions, and they are exact: a value with more than 2 decimal places is rejected, never rounded.

function exactHundredths(value: Decimal.Value, what: string): number {
  const scaled = new Decimal(value).mul(100);
  if (!scaled.isInteger())
    throw new RangeError(`${what} must have at most 2 decimal places.`);
  return scaled.toNumber();
}

/** 59.90 → 5990 */
export function toMinor(value: Decimal.Value): number {
  return exactHundredths(value, "An amount");
}

/** 5990 → 59.9 (a Decimal) */
export function fromMinor(minor: number): Money {
  return new Decimal(minor).div(100);
}

/** 10 (%) → 1000 basis points; 12.5 → 1250 */
export function toBasisPoints(percent: Decimal.Value): number {
  return exactHundredths(percent, "A percentage");
}

/** 1000 basis points → 10 (%) */
export function fromBasisPoints(basisPoints: number): Money {
  return new Decimal(basisPoints).div(100);
}
