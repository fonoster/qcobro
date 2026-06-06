import { useI18n, languages, type Language } from "../lib/i18n.js";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-gray-600">{t("language.label")}</span>
      <select
        className="rounded border border-gray-300 px-2 py-1"
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
