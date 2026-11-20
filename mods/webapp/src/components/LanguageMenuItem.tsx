import { Globe } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n, languages, languageNames, type Language } from "../lib/i18n.js";

/** The "Idioma" row of an account menu: a language select that applies the choice and saves
 * it to the profile. `onPicked` runs after a pick (the sidebar menu closes on it). */
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
    <div className="flex items-center justify-between gap-2.5 px-2.5 py-2">
      <span className="flex items-center gap-2.5 text-[13px] font-medium text-fg">
        <Globe className="h-4 w-4 text-fg-subtle" />
        {t("language.label")}
      </span>
      <select
        aria-label={t("language.label")}
        value={language}
        onChange={(e) => onChange(e.target.value as Language)}
        className="cursor-pointer rounded-md border-none bg-transparent text-[13px] font-medium text-fg-subtle focus:outline-none"
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
