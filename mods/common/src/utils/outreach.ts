import Handlebars from "handlebars";
import type { PortfolioAccountRecord } from "../types/portfolios.js";
import type { NumberSelector } from "../types/dispatch.js";

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

/** Default number selector: a uniform random pick from the pool. */
export const pickRandomNumber: NumberSelector = (numbers) =>
  numbers[Math.floor(Math.random() * numbers.length)];
