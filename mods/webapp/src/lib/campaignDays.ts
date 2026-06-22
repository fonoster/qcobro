import type { useI18n } from "./i18n.js";

type Translate = ReturnType<typeof useI18n>["t"];

/**
 * Renders a set of ISO weekday numbers (1 = Monday … 7 = Sunday) as a human-readable,
 * localized label: common runs collapse to "Weekdays" / "Weekends" / "Every day", and any
 * other combination becomes a comma-separated list of short day names (e.g. "Mon, Fri").
 */
export function humanizeDays(days: number[], t: Translate): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return "—";

  const key = sorted.join(",");
  if (key === "1,2,3,4,5") return t("campaigns.days.weekdays");
  if (key === "6,7") return t("campaigns.days.weekends");
  if (key === "1,2,3,4,5,6,7") return t("campaigns.days.everyday");

  return sorted.map((n) => t(`campaigns.days.${n}` as Parameters<Translate>[0])).join(", ");
}

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
