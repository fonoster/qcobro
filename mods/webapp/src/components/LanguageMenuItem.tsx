import { ChevronRight, Globe } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n, languages, languageNames, type Language } from "../lib/i18n.js";

/** The "Idioma" row of an account menu: "Idioma … Español >". A native select lies over the
 * row, so picking stays keyboard- and screen-reader-friendly (role combobox, name Idioma);
 * the choice applies at once and is saved to the profile. `onPicked` runs after a pick (the
 * sidebar menu closes on it). */
export function LanguageMenuItem({ onPicked }: { onPicked?: () => void }) {
  const { t, language, setLanguage } = useI18n();
  const utils = trpc.useUtils();
  const setLang = trpc.profile.setLanguage.useMutation();

  // Persist to the profile (the source of truth) so the AuthedLayout reconcile effect does
  // not revert the choice. Optimistically update the cache and the UI first, like the
  // Profile page does.
  function onChange(next: Language) {
    setLanguage(next);
    utils.profile.get.setData(undefined, (prev) => (prev ? { ...prev, language: next } : prev));
    setLang.mutate({ language: next }, { onSettled: () => utils.profile.get.invalidate() });
    onPicked?.();
  }

  return (
    <div className="relative flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 hover:bg-elevated focus-within:bg-elevated">
      <span className="flex items-center gap-2.5 text-[13px] text-fg">
        <Globe className="h-4 w-4 text-fg-muted" />
        {t("language.label")}
      </span>
      <span className="flex items-center gap-1 text-[13px] text-fg-muted">
        {languageNames[language]}
        <ChevronRight aria-hidden className="h-3.5 w-3.5" />
      </span>
      <select
        aria-label={t("language.label")}
        value={language}
        onChange={(e) => onChange(e.target.value as Language)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {languages.map((l) => (
          <option key={l} value={l}>
            {languageNames[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
