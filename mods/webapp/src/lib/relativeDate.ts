import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/es";
import type { Language } from "./i18n.js";

dayjs.extend(relativeTime);

/**
 * Human-friendly "time ago" for log tables, localized to the active language:
 * "Hace unos segundos", "Hace 5 minutos", "Hace 2 horas", "Hace 3 días", "Hace un mes"
 * (and the English equivalents). First letter capitalized for use as a standalone label.
 */
export function formatRelativeDate(date: Date | string, language: Language): string {
  const text = dayjs(date).locale(language).fromNow();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
