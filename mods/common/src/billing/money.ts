/**
 * Micro-unit money arithmetic for billing.
 *
 * All persisted monetary amounts are integer micro-units of the billing currency
 * (1 unit = 1,000,000 micro-units). Config rates are decimal JSON numbers converted
 * once at the config boundary; everything past it is integer-only so thousands of
 * sub-cent records aggregate with zero drift. Rounding to display/invoice precision
 * happens only at aggregation, never per record.
 */

export const MICRO_UNITS_PER_UNIT = 1_000_000;

/** Throws unless `value` is a safe-integer micro-unit amount. */
export function assertMicroUnits(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Not an integer micro-unit amount: ${value}`);
  }
}

/**
 * Converts a decimal currency amount (the config boundary) to integer micro-units,
 * absorbing binary float representation error (e.g. 0.0004 → exactly 400).
 */
export function toMicroUnits(amount: number): number {
  if (!Number.isFinite(amount)) throw new RangeError(`Not a finite amount: ${amount}`);
  const micro = Math.round(amount * MICRO_UNITS_PER_UNIT);
  assertMicroUnits(micro);
  return micro;
}

/** Sums micro-unit amounts, guarding every operand and the running total. */
export function sumMicroUnits(amounts: Iterable<number>): number {
  let total = 0;
  for (const amount of amounts) {
    assertMicroUnits(amount);
    total += amount;
    assertMicroUnits(total);
  }
  return total;
}

/**
 * Aggregation-time rounding: renders micro-units as a fixed-point decimal string
 * (default 2 fraction digits), rounding half away from zero using integer math.
 * This is the ONLY place billing amounts lose precision.
 */
export function microUnitsToDecimalString(micro: number, fractionDigits = 2): string {
  assertMicroUnits(micro);
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 6) {
    throw new RangeError(`fractionDigits must be an integer in [0, 6]: ${fractionDigits}`);
  }
  const scale = 10 ** fractionDigits;
  const microPerStep = MICRO_UNITS_PER_UNIT / scale;
  const steps = Math.round(Math.abs(micro) / microPerStep);
  const sign = micro < 0 && steps > 0 ? "-" : "";
  const whole = Math.floor(steps / scale);
  if (fractionDigits === 0) return `${sign}${whole}`;
  const frac = String(steps % scale).padStart(fractionDigits, "0");
  return `${sign}${whole}.${frac}`;
}
