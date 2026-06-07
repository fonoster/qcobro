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
    "language.label": "Language",
    "common.loading": "Loading…",
    "auth.loginTitle": "Sign in",
    "auth.signupTitle": "Create your account",
    "auth.name": "Full name",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.login": "Sign in",
    "auth.signup": "Create account",
    "auth.logout": "Sign out",
    "auth.invalidCredentials": "Invalid email or password.",
    "auth.signupFailed": "Could not create the account. Try a different email.",
    "auth.noAccount": "Don't have an account? Sign up",
    "auth.haveAccount": "Already have an account? Sign in",
    "auth.loginSubtitle": "Access your QCobro account",
    "auth.signupSubtitle": "Get started with QCobro in minutes",
    "auth.forgot": "Forgot your password?",
    "auth.continueGoogle": "Continue with Google",
    "auth.or": "or",
    "workspace.createTitle": "Create your workspace",
    "workspace.createSubtitle": "A workspace holds your portfolios, campaigns, and team.",
    "workspace.name": "Workspace name",
    "workspace.create": "Create workspace",
    "workspace.creating": "Creating…",
    "workspace.label": "Workspace",
    "home.welcome": "Welcome",
    "home.role": "Your role"
  },
  es: {
    "app.title": "Consola QCobro",
    "app.tagline": "Cobros con voz IA multilingüe",
    "language.label": "Idioma",
    "common.loading": "Cargando…",
    "auth.loginTitle": "Iniciar sesión",
    "auth.signupTitle": "Crea tu cuenta",
    "auth.name": "Nombre completo",
    "auth.email": "Correo",
    "auth.password": "Contraseña",
    "auth.login": "Iniciar sesión",
    "auth.signup": "Crear cuenta",
    "auth.logout": "Cerrar sesión",
    "auth.invalidCredentials": "Correo o contraseña inválidos.",
    "auth.signupFailed": "No se pudo crear la cuenta. Prueba con otro correo.",
    "auth.noAccount": "¿No tienes cuenta? Regístrate",
    "auth.haveAccount": "¿Ya tienes cuenta? Inicia sesión",
    "auth.loginSubtitle": "Accede a tu cuenta de QCobro",
    "auth.signupSubtitle": "Empieza con QCobro en minutos",
    "auth.forgot": "¿Olvidaste tu contraseña?",
    "auth.continueGoogle": "Continuar con Google",
    "auth.or": "o",
    "workspace.createTitle": "Crea tu espacio de trabajo",
    "workspace.createSubtitle": "Un espacio agrupa tus carteras, campañas y equipo.",
    "workspace.name": "Nombre del espacio",
    "workspace.create": "Crear espacio",
    "workspace.creating": "Creando…",
    "workspace.label": "Espacio",
    "home.welcome": "Bienvenido",
    "home.role": "Tu rol"
  }
} as const;

export type Language = keyof typeof messages;
export type MessageId = keyof (typeof messages)[Language];

export const languages = Object.keys(messages) as Language[];
export const defaultLanguage: Language = "es";

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
