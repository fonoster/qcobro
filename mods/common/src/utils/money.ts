import type { Locale } from "../schemas/workspaceSettings.js";

/**
 * Formats an amount for a workspace's locale, with grouping separators.
 *
 * This exists for how amounts are *heard*, not how they look: text-to-speech reads a bare
 * `9500` wrong and `9,500` right, and the provider (ElevenLabs) offers no SSML `<say-as>`
 * control, so the only lever is the text QCobro produces. Rendered outreach bodies are the
 * caller.
 *
 * Fraction digits are two when the amount has a fractional part and none when it does not,
 * so a round balance reads "nueve mil quinientos" rather than "…coma cero cero", and a
 * fractional one reads "…con cincuenta" rather than "…coma cinco".
 */
export function formatMoney(value: number, locale: Locale): string {
  if (!Number.isFinite(value)) return "";
  const hasFraction = !Number.isInteger(value);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
    useGrouping: true
  }).format(value);
}

/**
 * The separators a locale uses, discovered from `Intl` rather than assumed — `9.500` is nine
 * thousand five hundred in es-ES and nine-and-a-half in es-DO, so stripping a hardcoded comma
 * would silently corrupt amounts the moment a second market is added.
 */
function separatorsFor(locale: Locale): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    useGrouping: true
  }).formatToParts(12345.6);
  return {
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? "."
  };
}

/** Collapses every space-like separator shape to a plain ASCII space. */
function normalizeSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f\u2007\u2009\u3000]/g, " ");
}

/**
 * Parses a value that may be a number or a locale-formatted amount back to a number, so the
 * template helpers keep working now that money-typed context fields render formatted. Returns
 * `NaN` for anything unparseable — callers preserve their existing malformed-context
 * behavior (`multiply` yields 0, comparisons yield false) rather than leaking `NaN` into
 * customer-facing copy.
 */
export function toNumber(value: unknown, locale: Locale): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number(value);

  const trimmed = value.trim();
  if (trimmed === "") return NaN;

  const { group, decimal } = separatorsFor(locale);
  // Some locales group with a non-breaking or narrow no-break space. Normalize every space
  // shape to a plain one — in the value *and* in the separator — or the strip silently
  // misses and `9 500` parses as NaN.
  const normalized = normalizeSpaces(trimmed)
    .split(normalizeSpaces(group))
    .join("")
    .split(decimal)
    .join(".");

  return Number(normalized);
}
