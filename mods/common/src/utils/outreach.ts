import Handlebars from "handlebars";
import type { PortfolioAccountRecord } from "../types/portfolios.js";
import type { NumberSelector, WhatsAppTemplateParam } from "../types/dispatch.js";
import { DEFAULT_LOCALE, type Locale } from "../schemas/workspaceSettings.js";
import { formatMoney, toNumber } from "./money.js";

/**
 * The workspace locale for the render in progress, read off the root context that
 * {@link buildOutreachContext} builds. Helpers are registered once, globally, so the locale
 * cannot be closed over at registration — it has to come from the context being rendered.
 * A context assembled some other way (a bare object in a test, a legacy caller) falls back to
 * the default rather than throwing mid-dispatch.
 */
function localeOf(options: unknown): Locale {
  const root = (options as { data?: { root?: Record<string, unknown> } })?.data?.root;
  const value = root?.locale;
  if (typeof value !== "string" || value === "") return DEFAULT_LOCALE;
  try {
    // The supported-locale check belongs at the settings boundary, not here — re-checking it
    // would make a helper silently ignore the workspace's own locale. All this guards is a
    // malformed tag, which `Intl` throws a RangeError for; that must not surface as a
    // template error in the middle of a customer-facing body.
    new Intl.NumberFormat(value);
    return value as Locale;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * `{{multiply a b}}` — multiplies two amounts. Operands may be raw numbers or the
 * locale-formatted amounts that money-typed context fields now render as (`"9,500"`), and the
 * result is formatted the same way, so `{{multiply outstandingBalance 0.5}}` reads aloud like
 * a stored balance. Either operand being non-numeric (missing field, bad data) yields 0
 * rather than NaN, so a malformed context never produces `NaN` in a customer-facing message.
 */
Handlebars.registerHelper("multiply", (a: unknown, b: unknown, options: unknown) => {
  const locale = localeOf(options);
  const x = toNumber(a, locale);
  const y = toNumber(b, locale);
  return Number.isFinite(x) && Number.isFinite(y) ? formatMoney(x * y, locale) : 0;
});

/**
 * `{{eq a b}}` — strict equality, for branching on exact values (e.g.
 * `{{#if (eq customerSegment "variant_A")}}`). Numeric operands are compared by value, so
 * comparing a money-typed field against a number still works now that it renders formatted.
 */
Handlebars.registerHelper("eq", (a: unknown, b: unknown, options: unknown) => {
  if (a === b) return true;
  const locale = localeOf(options);
  const x = toNumber(a, locale);
  const y = toNumber(b, locale);
  return Number.isFinite(x) && Number.isFinite(y) && x === y;
});

/**
 * `{{gt a b}}` / `{{gte a b}}` / `{{lt a b}}` / `{{lte a b}}` — numeric
 * comparisons for use inside `{{#if}}`, e.g. `{{#if (gte daysPastDue 30)}}`.
 * Operands are parsed with the workspace locale so a formatted amount compares by its
 * underlying value; anything unparseable becomes `NaN`, and every JS comparison against
 * `NaN` is `false` — so a malformed context makes the condition not match rather than
 * throwing. `ge` is registered as an alias of `gte` (both names are in common use).
 */
Handlebars.registerHelper(
  "gt",
  (a: unknown, b: unknown, o: unknown) => toNumber(a, localeOf(o)) > toNumber(b, localeOf(o))
);
Handlebars.registerHelper(
  "gte",
  (a: unknown, b: unknown, o: unknown) => toNumber(a, localeOf(o)) >= toNumber(b, localeOf(o))
);
Handlebars.registerHelper(
  "ge",
  (a: unknown, b: unknown, o: unknown) => toNumber(a, localeOf(o)) >= toNumber(b, localeOf(o))
);
Handlebars.registerHelper(
  "lt",
  (a: unknown, b: unknown, o: unknown) => toNumber(a, localeOf(o)) < toNumber(b, localeOf(o))
);
Handlebars.registerHelper(
  "lte",
  (a: unknown, b: unknown, o: unknown) => toNumber(a, localeOf(o)) <= toNumber(b, localeOf(o))
);

/**
 * `{{digits value}}` — renders a value's digits separated by single spaces
 * (`"8092323333"` → `"8 0 9 2 3 2 3 3 3 3"`) so text-to-speech reads them one at a time
 * instead of as a single quantity. Non-digit characters are dropped, so a stored
 * `"+1 (809) 232-3333"` works as-is; an empty or missing value renders empty rather than
 * aborting the dispatch.
 *
 * This one stays opt-in — only the template author knows a value should be spelled out.
 * `{{digits phone}}` is right, `{{digits outstandingBalance}}` is not.
 */
Handlebars.registerHelper("digits", (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\D/g, "").split("").join(" ");
});

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * `{{daysSince date}}` / `{{daysUntil date}}` — whole days between `date` and
 * now (rounded down), for copy like "han pasado {{daysSince lastPaymentDate}}
 * días desde su último pago". An unparseable or missing date yields `0`
 * rather than `NaN`, matching `multiply`'s malformed-context handling.
 */
Handlebars.registerHelper("daysSince", (value: unknown) => {
  const date = toDate(value);
  return date ? Math.floor((Date.now() - date.getTime()) / DAY_MS) : 0;
});
Handlebars.registerHelper("daysUntil", (value: unknown) => {
  const date = toDate(value);
  return date ? Math.floor((date.getTime() - Date.now()) / DAY_MS) : 0;
});

/**
 * Renders a Handlebars template against a context. Bodies are plain text (voice
 * script / SMS), never HTML, so escaping is disabled. A missing `{{field}}`
 * renders as empty rather than throwing, so a sparse account never aborts a
 * dispatch mid-flight.
 *
 * A malformed template — most commonly a reference to an unregistered helper,
 * e.g. `{{multiply amount rate}}` before that helper existed — throws a
 * synchronous Handlebars compile/render error. That used to propagate
 * uncaught, crashing the webapp's live template preview
 * (`ReachOutModal.tsx`) and, in the dispatch pipeline, aborting the send
 * attempt. Both are now caught here: the error surfaces as a visible
 * `[Error de plantilla: ...]` marker in the rendered output instead of
 * throwing, so a template bug is obvious without taking down a preview or a
 * send.
 */
export function renderTemplate(template: string, context: Record<string, unknown>): string {
  try {
    const compiled = Handlebars.compile(template, { noEscape: true });
    return compiled(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `[Error de plantilla: ${message}]`;
  }
}

/**
 * Extracts the distinct simple placeholder names from a template, in first-seen order
 * (e.g. `"Hola {{firstName}}, saldo {{outstandingBalance}}"` → `["firstName",
 * "outstandingBalance"]`). Block helpers like `{{#if}}`/`{{/if}}` are ignored. Used to
 * turn a WhatsApp template body into Meta **named** parameters: each token becomes a
 * `{ parameter_name, text }` pair rendered against the customer context.
 */
export function extractTemplateTokens(template: string): string[] {
  const tokens: string[] = [];
  const re = /\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    if (!tokens.includes(match[1])) tokens.push(match[1]);
  }
  return tokens;
}

/**
 * Builds the render context exposed to outreach templates: every account field
 * plus derived `firstName` (first token of `fullName`), `currency` (the
 * workspace's currency from WorkspaceSettings), and `isDue` (whether the account
 * is past due, i.e. `daysPastDue > 0`). `isDue` is a boolean so templates can
 * branch on it with Handlebars conditionals, e.g.
 * `{{#if isDue}}su pago está vencido{{else}}gracias por estar al día{{/if}}`.
 * These are the variables documented in the agent console.
 */
export function buildOutreachContext(
  account: PortfolioAccountRecord,
  opts: { currency: string; locale: Locale }
): Record<string, unknown> {
  const firstName = account.fullName.trim().split(/\s+/)[0] ?? "";
  const money = (value: number | null): string | null =>
    value === null ? null : formatMoney(value, opts.locale);

  return {
    ...account,
    // Money-typed fields are formatted here rather than at each call site so every channel —
    // and the console's live preview — renders the same text. Counts (daysPastDue,
    // missedInstallments, termsLength) stay numeric: a count with a thousands separator is
    // wrong, and `{{daysPastDue}}` reads correctly as-is.
    outstandingBalance: money(account.outstandingBalance),
    principalAmount: money(account.principalAmount),
    termsAmount: money(account.termsAmount),
    lastPaymentAmount: money(account.lastPaymentAmount),
    firstName,
    currency: opts.currency,
    // Read by the numeric helpers to parse formatted operands back to numbers.
    locale: opts.locale,
    isDue: account.daysPastDue > 0
  };
}

/**
 * Builds the "Contexto — ..." bullet lines an autopilot prompt (WhatsApp/Email) shows the
 * model, from a {@link buildOutreachContext} result. Only factual account/loan data the
 * customer already has a right to see — never `negotiationOptions` (internal, freeform
 * admin notes on negotiation flexibility, not safe for the model to repeat verbatim).
 *
 * Skips fields that aren't meaningful for the current account (e.g. `daysPastDue` when the
 * account isn't past due) so the model isn't fed noise, but always includes the ones that
 * let it answer basic loan questions (balance, terms, due status, last payment) instead of
 * just the outstanding balance — the model otherwise has nothing to work with beyond the
 * balance and can't answer "how much do I owe in total" or "when's my next payment due".
 */
export function buildAutopilotContextLines(context: Record<string, unknown> | undefined): string[] {
  if (!context) return [];
  const lines: string[] = [];
  const currency = typeof context.currency === "string" ? ` ${context.currency}` : "";
  const locale = typeof context.locale === "string" ? (context.locale as Locale) : DEFAULT_LOCALE;

  /**
   * Money-typed context fields are locale-formatted strings, not numbers, so these lines read
   * the amount back through the locale rather than testing `typeof === "number"` — that guard
   * would now silently drop every amount from the model's context.
   */
  const amount = (value: unknown): { text: string; value: number } | null => {
    if (value === null || value === undefined) return null;
    const parsed = toNumber(value, locale);
    return Number.isFinite(parsed) ? { text: String(value), value: parsed } : null;
  };

  if (typeof context.firstName === "string" && context.firstName) {
    lines.push(`Cliente: ${context.firstName}`);
  }
  const balance = amount(context.outstandingBalance);
  if (balance) {
    lines.push(`Saldo pendiente: ${balance.text}${currency}`);
  }
  const principal = amount(context.principalAmount);
  if (principal && principal.value > 0) {
    lines.push(`Monto original del préstamo: ${principal.text}${currency}`);
  }
  const installment = amount(context.termsAmount);
  if (installment && installment.value > 0) {
    const freq =
      typeof context.termsFrequency === "string" && context.termsFrequency
        ? ` (${context.termsFrequency})`
        : "";
    lines.push(`Cuota: ${installment.text}${currency}${freq}`);
  }
  if (typeof context.termsLength === "number" && context.termsLength > 0) {
    lines.push(`Plazo: ${context.termsLength} cuotas`);
  }
  if (typeof context.daysPastDue === "number" && context.daysPastDue > 0) {
    lines.push(`Días de atraso: ${context.daysPastDue}`);
  }
  if (typeof context.missedInstallments === "number" && context.missedInstallments > 0) {
    lines.push(`Cuotas incumplidas: ${context.missedInstallments}`);
  }
  if (context.lastPaymentDate) {
    const date =
      context.lastPaymentDate instanceof Date
        ? context.lastPaymentDate
        : new Date(context.lastPaymentDate as string);
    if (!Number.isNaN(date.getTime())) {
      const lastPayment = amount(context.lastPaymentAmount);
      const paid = lastPayment ? ` de ${lastPayment.text}${currency}` : "";
      lines.push(`Último pago${paid}: ${date.toISOString().slice(0, 10)}`);
    }
  }

  return lines;
}

/** Default number selector: a uniform random pick from the pool. */
export const pickRandomNumber: NumberSelector = (numbers) =>
  numbers[Math.floor(Math.random() * numbers.length)];

/**
 * Meta requires WhatsApp template named parameters to be lowercase snake_case
 * (`{{first_name}}`) — it rejects camelCase placeholders outright, so a Meta template can
 * never literally use the `firstName`-style names the render context and every other
 * channel's Handlebars templates use. Converts a snake_case token to its camelCase context
 * key, e.g. `first_name` -> `firstName`, `outstanding_balance` -> `outstandingBalance`. A
 * token with no underscore is returned unchanged.
 */
export function snakeToCamel(token: string): string {
  return token.replace(/_([A-Za-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Resolves a WhatsApp template body's Meta named parameters against the outreach context,
 * and builds a substituted copy of the body for display (live preview, gestión history).
 * Each `{{snake_case_token}}` in the body maps to the camelCase context field of the same
 * name (see {@link snakeToCamel}); `parameterName` sent to Meta stays the literal token as
 * written in the approved template — only the context lookup is translated.
 */
export function renderWhatsAppTemplate(
  body: string,
  context: Record<string, unknown>
): { renderedBody: string; params: WhatsAppTemplateParam[] } {
  const params = extractTemplateTokens(body).map((token) => ({
    parameterName: token,
    text: renderTemplate(`{{${snakeToCamel(token)}}}`, context)
  }));
  let renderedBody = body;
  for (const { parameterName, text } of params) {
    renderedBody = renderedBody.replace(
      new RegExp(`\\{\\{\\s*${parameterName}\\s*\\}\\}`, "g"),
      text
    );
  }
  return { renderedBody, params };
}
