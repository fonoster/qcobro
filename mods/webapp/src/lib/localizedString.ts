import type { LocalizedString } from "@qcobro/common";
import { defaultLanguage } from "./i18n.js";

/**
 * Resolve a `LocalizedString` config value (plain string or {lang: text} map)
 * against the active UI language, falling back to the deployment default and
 * then to any available value. THE single resolver for config-sourced copy
 * (plan names, announcements) — do not re-derive this shape locally.
 */
export function resolveLocalizedString(value: LocalizedString, language: string): string {
  if (typeof value === "string") return value;
  return value[language] ?? value[defaultLanguage] ?? Object.values(value)[0] ?? "";
}
