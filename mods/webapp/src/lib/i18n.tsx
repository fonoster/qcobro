import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Minimal internationalization layer.
 *
 * All user-facing copy is resolved through `t(messageId)` rather than hardcoded
 * literals, and the active language is configurable at runtime. The product is
 * multilingual by design — no language is privileged as the only option.
 */
export const messages = {
  en: {
    "app.title": "QCobro Console",
    "app.tagline": "Multilingual AI-voice collections",
    "nav.home": "Home",
    "home.heading": "Foundation ready",
    "language.label": "Language"
  },
  es: {
    "app.title": "Consola QCobro",
    "app.tagline": "Cobros con voz IA multilingüe",
    "nav.home": "Inicio",
    "home.heading": "Base lista",
    "language.label": "Idioma"
  }
} as const;

export type Language = keyof typeof messages;
export type MessageId = keyof (typeof messages)[Language];

export const languages = Object.keys(messages) as Language[];
export const defaultLanguage: Language = "en";

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (id: MessageId) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLanguage = defaultLanguage
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (id) => messages[language][id]
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an <I18nProvider>");
  }
  return ctx;
}
