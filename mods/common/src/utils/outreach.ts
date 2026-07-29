import Handlebars from "handlebars";
import type { PortfolioAccountRecord } from "../types/portfolios.js";
import type { NumberSelector, WhatsAppTemplateParam } from "../types/dispatch.js";

/**
 * `{{multiply a b}}` — coerces both operands to numbers; either operand being
 * non-numeric (missing field, bad data) yields 0 rather than NaN, so a
 * malformed context never produces `NaN` in a customer-facing message.
 */
Handlebars.registerHelper("multiply", (a: unknown, b: unknown) => {
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) ? x * y : 0;
});

/**
 * `{{eq a b}}` — strict equality, for branching on exact values (e.g.
 * `{{#if (eq customerSegment "variant_A")}}`).
 */
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);

/**
 * `{{gt a b}}` / `{{gte a b}}` / `{{lt a b}}` / `{{lte a b}}` — numeric
 * comparisons for use inside `{{#if}}`, e.g. `{{#if (gte daysPastDue 30)}}`.
 * Operands are coerced with `Number()`; a non-numeric operand becomes `NaN`,
 * and every JS comparison against `NaN` is `false` — so a malformed context
 * makes the condition not match rather than throwing. `ge` is registered as
 * an alias of `gte` (both names are in common use).
 */
Handlebars.registerHelper("gt", (a: unknown, b: unknown) => Number(a) > Number(b));
Handlebars.registerHelper("gte", (a: unknown, b: unknown) => Number(a) >= Number(b));
Handlebars.registerHelper("ge", (a: unknown, b: unknown) => Number(a) >= Number(b));
Handlebars.registerHelper("lt", (a: unknown, b: unknown) => Number(a) < Number(b));
Handlebars.registerHelper("lte", (a: unknown, b: unknown) => Number(a) <= Number(b));

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
  opts: { currency: string }
): Record<string, unknown> {
  const firstName = account.fullName.trim().split(/\s+/)[0] ?? "";
  return {
    ...account,
    firstName,
    currency: opts.currency,
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

  if (typeof context.firstName === "string" && context.firstName) {
    lines.push(`Cliente: ${context.firstName}`);
  }
  if (typeof context.outstandingBalance === "number") {
    lines.push(`Saldo pendiente: ${context.outstandingBalance}${currency}`);
  }
  if (typeof context.principalAmount === "number" && context.principalAmount > 0) {
    lines.push(`Monto original del préstamo: ${context.principalAmount}${currency}`);
  }
  if (typeof context.termsAmount === "number" && context.termsAmount > 0) {
    const freq =
      typeof context.termsFrequency === "string" && context.termsFrequency
        ? ` (${context.termsFrequency})`
        : "";
    lines.push(`Cuota: ${context.termsAmount}${currency}${freq}`);
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
      const amount =
        typeof context.lastPaymentAmount === "number"
          ? ` de ${context.lastPaymentAmount}${currency}`
          : "";
      lines.push(`Último pago${amount}: ${date.toISOString().slice(0, 10)}`);
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
