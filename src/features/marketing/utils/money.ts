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
