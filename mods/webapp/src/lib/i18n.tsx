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
    "verify.title": "Verify your email",
    "verify.subtitle": "Enter the verification code we sent to your email.",
    "verify.codeLabel": "Verification code",
    "verify.submit": "Verify",
    "verify.verifying": "Verifying…",
    "verify.resend": "Resend code",
    "verify.sent": "Code sent.",
    "verify.failed": "Invalid code. Try again.",
    "verify.skip": "Skip for now",
    "workspace.createTitle": "Create your workspace",
    "workspace.createSubtitle": "A workspace holds your portfolios, campaigns, and team.",
    "workspace.name": "Workspace name",
    "workspace.create": "Create workspace",
    "workspace.creating": "Creating…",
    "workspace.label": "Workspace",
    "home.welcome": "Welcome",
    "home.role": "Your role",
    "portfolios.title": "Portfolios",
    "portfolios.description": "Manage customer debt portfolios for your campaigns.",
    "portfolios.new": "New Portfolio",
    "portfolios.col.name": "Name",
    "portfolios.col.clientId": "Client",
    "portfolios.col.accounts": "Accounts",
    "portfolios.col.balance": "Outstanding Balance",
    "portfolios.col.recovered": "Recovered (est.)",
    "portfolios.col.status": "Status",
    "portfolios.col.created": "Created",
    "portfolios.status.ACTIVE": "Active",
    "portfolios.status.PAUSED": "Paused",
    "portfolios.status.ARCHIVED": "Archived",
    "portfolios.status.CLOSED": "Closed",
    "portfolios.filter.activeAndPaused": "Active and paused",
    "portfolios.filter.activeOnly": "Active only",
    "portfolios.filter.pausedOnly": "Paused only",
    "portfolios.filter.archived": "Archived",
    "portfolios.actions.sync": "Sync CSV",
    "portfolios.actions.edit": "Edit",
    "portfolios.actions.delete": "Delete",
    "portfolios.form.currency": "Currency",
    "portfolios.currency.USD": "US Dollar (USD)",
    "portfolios.currency.DOP": "Dominican Peso (DOP)",
    "portfolios.form.name": "Portfolio name",
    "portfolios.form.clientId": "Client ID",
    "portfolios.form.balance": "Total outstanding balance",
    "portfolios.form.editTitle": "Edit portfolio",
    "portfolios.form.create": "Create portfolio",
    "portfolios.form.save": "Save changes",
    "portfolios.form.csvNote":
      "Balance and account count are computed automatically from CSV imports.",
    "portfolios.form.recoveredAmount": "Reported recovered amount",
    "portfolios.form.recoveredAmountHint":
      "Manually reported figure based on external data. Balance and account count are computed automatically from CSV imports.",
    "portfolios.form.delete": "Delete portfolio",
    "portfolios.form.status": "Status",
    "portfolios.delete.title": "Delete portfolio",
    "portfolios.delete.description":
      "This will permanently delete the portfolio and all its account records. This cannot be undone.",
    "portfolios.csv.title": "Import accounts",
    "portfolios.csv.description": "Sync customer accounts from a CSV file.",
    "portfolios.csv.selectFile": "Select file",
    "portfolios.csv.noFile": "No file selected",
    "portfolios.csv.mode.label": "Sync mode",
    "portfolios.csv.mode.APPEND_ONLY.label": "Append only",
    "portfolios.csv.mode.APPEND_ONLY.description":
      "Add new accounts. Does not modify or remove existing ones.",
    "portfolios.csv.mode.UPDATE_EXISTING.label": "Append and update",
    "portfolios.csv.mode.UPDATE_EXISTING.description":
      "Add new accounts and update fields of existing ones. No deletions.",
    "portfolios.csv.mode.REPLACE.label": "Full replace",
    "portfolios.csv.mode.REPLACE.description":
      "Add new, update existing, and archive accounts absent from the file.",
    "portfolios.csv.import": "Import {n} accounts",
    "portfolios.csv.importing": "Importing…",
    "portfolios.csv.done": "Import complete",
    "portfolios.csv.close": "Close",
    "portfolios.csv.created": "Added",
    "portfolios.csv.updated": "Updated",
    "portfolios.csv.archived": "Archived",
    "portfolios.csv.total": "Total active",
    "portfolios.csv.errors.title": "File errors",
    "portfolios.csv.error.title": "Import error",
    "portfolios.csv.ready": "{n} accounts ready to import.",
    "portfolios.detail.title": "Accounts",
    "portfolios.detail.col.name": "Name",
    "portfolios.detail.col.externalId": "Loan ID",
    "portfolios.detail.col.phone": "Phone",
    "portfolios.detail.col.balance": "Balance",
    "portfolios.detail.col.dpd": "DPD",
    "portfolios.detail.col.language": "Language",
    "portfolios.detail.back": "Back to portfolios"
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
    "verify.title": "Verifica tu correo electrónico",
    "verify.subtitle": "Ingresa el código de verificación que enviamos a tu correo.",
    "verify.codeLabel": "Código de verificación",
    "verify.submit": "Verificar",
    "verify.verifying": "Verificando…",
    "verify.resend": "Reenviar código",
    "verify.sent": "Código enviado.",
    "verify.failed": "Código inválido. Inténtalo de nuevo.",
    "verify.skip": "Omitir por ahora",
    "workspace.createTitle": "Crea tu espacio de trabajo",
    "workspace.createSubtitle": "Un espacio agrupa tus carteras, campañas y equipo.",
    "workspace.name": "Nombre del espacio",
    "workspace.create": "Crear espacio",
    "workspace.creating": "Creando…",
    "workspace.label": "Espacio",
    "home.welcome": "Bienvenido",
    "home.role": "Tu rol",
    "portfolios.title": "Carteras",
    "portfolios.description": "Gestiona las carteras de clientes para tus campañas.",
    "portfolios.new": "Nueva cartera",
    "portfolios.col.name": "Nombre",
    "portfolios.col.clientId": "Cliente",
    "portfolios.col.accounts": "Cuentas",
    "portfolios.col.balance": "Saldo pendiente",
    "portfolios.col.recovered": "Recuperado (est.)",
    "portfolios.col.status": "Estado",
    "portfolios.col.created": "Creado",
    "portfolios.status.ACTIVE": "Activa",
    "portfolios.status.PAUSED": "Pausada",
    "portfolios.status.ARCHIVED": "Archivada",
    "portfolios.status.CLOSED": "Cerrada",
    "portfolios.filter.activeAndPaused": "Activas y pausadas",
    "portfolios.filter.activeOnly": "Solo activas",
    "portfolios.filter.pausedOnly": "Solo pausadas",
    "portfolios.filter.archived": "Archivadas",
    "portfolios.actions.sync": "Sincronizar CSV",
    "portfolios.actions.edit": "Editar",
    "portfolios.actions.delete": "Eliminar",
    "portfolios.form.currency": "Moneda",
    "portfolios.currency.USD": "Dólar americano (USD)",
    "portfolios.currency.DOP": "Peso dominicano (DOP)",
    "portfolios.form.name": "Nombre de la cartera",
    "portfolios.form.clientId": "ID del cliente",
    "portfolios.form.balance": "Saldo pendiente total",
    "portfolios.form.editTitle": "Editar cartera",
    "portfolios.form.create": "Crear cartera",
    "portfolios.form.save": "Guardar cambios",
    "portfolios.form.csvNote":
      "El saldo y el conteo de cuentas se calculan automáticamente al importar el CSV.",
    "portfolios.form.recoveredAmount": "Monto recuperado reportado",
    "portfolios.form.recoveredAmountHint":
      "Cifra reportada manualmente según datos externos. El saldo y el conteo de cuentas se calculan automáticamente al importar el CSV.",
    "portfolios.form.delete": "Eliminar cartera",
    "portfolios.form.status": "Estado",
    "portfolios.delete.title": "Eliminar cartera",
    "portfolios.delete.description":
      "Esto eliminará permanentemente la cartera y todos sus registros de cuentas. Esta acción no se puede deshacer.",
    "portfolios.csv.title": "Importar cuentas",
    "portfolios.csv.description": "Sincronizar cuentas de clientes desde un archivo CSV.",
    "portfolios.csv.selectFile": "Seleccionar archivo",
    "portfolios.csv.noFile": "Ningún archivo seleccionado",
    "portfolios.csv.mode.label": "Modo de sincronización",
    "portfolios.csv.mode.APPEND_ONLY.label": "Solo agregar nuevas",
    "portfolios.csv.mode.APPEND_ONLY.description":
      "Agrega cuentas nuevas. No modifica ni elimina las existentes.",
    "portfolios.csv.mode.UPDATE_EXISTING.label": "Agregar y actualizar",
    "portfolios.csv.mode.UPDATE_EXISTING.description":
      "Agrega cuentas nuevas y actualiza los campos de las existentes. No elimina.",
    "portfolios.csv.mode.REPLACE.label": "Reemplazar todo",
    "portfolios.csv.mode.REPLACE.description":
      "Agrega nuevas, actualiza existentes y archiva las que no estén en el CSV.",
    "portfolios.csv.import": "Importar {n} cuentas",
    "portfolios.csv.importing": "Importando…",
    "portfolios.csv.done": "Importación completada",
    "portfolios.csv.close": "Cerrar",
    "portfolios.csv.created": "Agregadas",
    "portfolios.csv.updated": "Actualizadas",
    "portfolios.csv.archived": "Archivadas",
    "portfolios.csv.total": "Total activas",
    "portfolios.csv.errors.title": "Errores en el archivo",
    "portfolios.csv.error.title": "Error al importar",
    "portfolios.csv.ready": "{n} cuentas listas para importar.",
    "portfolios.detail.title": "Cuentas",
    "portfolios.detail.col.name": "Nombre",
    "portfolios.detail.col.externalId": "ID Préstamo",
    "portfolios.detail.col.phone": "Teléfono",
    "portfolios.detail.col.balance": "Saldo",
    "portfolios.detail.col.dpd": "DPD",
    "portfolios.detail.col.language": "Idioma",
    "portfolios.detail.back": "Volver a carteras"
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
