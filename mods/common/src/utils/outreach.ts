import Handlebars from "handlebars";
import type { PortfolioAccountRecord } from "../types/portfolios.js";
import type { NumberSelector } from "../types/dispatch.js";

/**
 * Renders a Handlebars template against a context. Bodies are plain text (voice
 * script / SMS), never HTML, so escaping is disabled. A missing `{{field}}`
 * renders as empty rather than throwing, so a sparse account never aborts a
 * dispatch mid-flight.
 */
export function renderTemplate(template: string, context: Record<string, unknown>): string {
  const compiled = Handlebars.compile(template, { noEscape: true });
  return compiled(context);
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
