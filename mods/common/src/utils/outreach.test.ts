import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderTemplate,
  buildOutreachContext,
  buildAutopilotContextLines,
  pickRandomNumber,
  snakeToCamel,
  renderWhatsAppTemplate
} from "./outreach.js";
import type { PortfolioAccountRecord } from "../types/portfolios.js";
import type { Locale } from "../schemas/workspaceSettings.js";

const esDO = "es-DO" as Locale;
// Not in `supportedLocales` yet; cast so these assertions prove the formatting follows the
// workspace locale rather than a hardcoded comma.
const esES = "es-ES" as Locale;

function makeAccount(overrides: Partial<PortfolioAccountRecord> = {}): PortfolioAccountRecord {
  return {
    id: "acc-1",
    portfolioId: "pf-1",
    externalId: "EXT-1",
    fullName: "María López",
    phone: "+50670000000",
    preferredLanguage: "es",
    bestTimeToCall: null,
    customerSegment: null,
    principalAmount: 1000,
    termsAmount: 0,
    termsFrequency: null,
    termsLength: 0,
    outstandingBalance: 1500,
    daysPastDue: 30,
    missedInstallments: 2,
    lastPaymentDate: null,
    lastPaymentAmount: null,
    negotiationOptions: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe("renderTemplate + buildOutreachContext", () => {
  it("personalizes a body with account data and derived fields", () => {
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC", locale: esDO });
    const out = renderTemplate(
      "Hola {{firstName}}, su saldo es {{outstandingBalance}} {{currency}}",
      ctx
    );
    assert.equal(out, "Hola María, su saldo es 1,500 CRC");
  });

  it("renders a missing field as empty without throwing", () => {
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC", locale: esDO });
    const out = renderTemplate("Hola {{firstName}} {{unknownField}}!", ctx);
    assert.equal(out, "Hola María !");
  });

  it("derives firstName from the first token of fullName", () => {
    const ctx = buildOutreachContext(makeAccount({ fullName: "Juan Carlos Pérez" }), {
      currency: "USD",
      locale: esDO
    });
    assert.equal(ctx.firstName, "Juan");
  });

  it("derives isDue from daysPastDue", () => {
    const overdue = buildOutreachContext(makeAccount({ daysPastDue: 30 }), {
      currency: "CRC",
      locale: esDO
    });
    const current = buildOutreachContext(makeAccount({ daysPastDue: 0 }), {
      currency: "CRC",
      locale: esDO
    });
    assert.equal(overdue.isDue, true);
    assert.equal(current.isDue, false);
  });

  it("branches a template on the isDue conditional", () => {
    const tpl = "{{#if isDue}}Su pago está vencido{{else}}Gracias por estar al día{{/if}}";
    const overdue = renderTemplate(
      tpl,
      buildOutreachContext(makeAccount({ daysPastDue: 5 }), { currency: "CRC", locale: esDO })
    );
    const current = renderTemplate(
      tpl,
      buildOutreachContext(makeAccount({ daysPastDue: 0 }), { currency: "CRC", locale: esDO })
    );
    assert.equal(overdue, "Su pago está vencido");
    assert.equal(current, "Gracias por estar al día");
  });

  it("multiplies two numeric fields with the multiply helper", () => {
    const ctx = buildOutreachContext(makeAccount({ outstandingBalance: 1000 }), {
      currency: "CRC",
      locale: esDO
    });
    const out = renderTemplate("Oferta: {{multiply outstandingBalance 0.5}} {{currency}}", ctx);
    assert.equal(out, "Oferta: 500 CRC");
  });

  it("multiply helper yields 0 instead of NaN for non-numeric operands", () => {
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC", locale: esDO });
    const out = renderTemplate("{{multiply unknownField 2}}", ctx);
    assert.equal(out, "0");
  });

  it("a reference to an unregistered helper surfaces as a marker instead of throwing", () => {
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC", locale: esDO });
    assert.doesNotThrow(() => renderTemplate("{{notAHelper firstName}}", ctx));
    const out = renderTemplate("{{notAHelper firstName}}", ctx);
    assert.match(out, /^\[Error de plantilla:.*notAHelper.*\]$/);
  });

  it("eq branches a template on an exact match", () => {
    const ctx = buildOutreachContext(makeAccount({ customerSegment: "variant_A" }), {
      currency: "CRC",
      locale: esDO
    });
    const out = renderTemplate('{{#if (eq customerSegment "variant_A")}}A{{else}}B{{/if}}', ctx);
    assert.equal(out, "A");
  });

  it("gt/gte/lt/lte compare numeric fields", () => {
    const ctx = buildOutreachContext(makeAccount({ daysPastDue: 30 }), {
      currency: "CRC",
      locale: esDO
    });
    assert.equal(renderTemplate("{{#if (gt daysPastDue 10)}}yes{{else}}no{{/if}}", ctx), "yes");
    assert.equal(renderTemplate("{{#if (gte daysPastDue 30)}}yes{{else}}no{{/if}}", ctx), "yes");
    assert.equal(renderTemplate("{{#if (lt daysPastDue 10)}}yes{{else}}no{{/if}}", ctx), "no");
    assert.equal(renderTemplate("{{#if (lte daysPastDue 30)}}yes{{else}}no{{/if}}", ctx), "yes");
  });

  it("ge is an alias of gte", () => {
    const ctx = buildOutreachContext(makeAccount({ daysPastDue: 30 }), {
      currency: "CRC",
      locale: esDO
    });
    assert.equal(renderTemplate("{{#if (ge daysPastDue 30)}}yes{{else}}no{{/if}}", ctx), "yes");
  });

  it("comparison helpers yield false instead of throwing for non-numeric operands", () => {
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC", locale: esDO });
    assert.equal(renderTemplate("{{#if (gt unknownField 10)}}yes{{else}}no{{/if}}", ctx), "no");
  });

  it("daysSince/daysUntil compute whole days against now", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const fiveDaysAhead = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 60_000).toISOString();
    const ctx = buildOutreachContext(makeAccount({ lastPaymentDate: new Date(tenDaysAgo) }), {
      currency: "CRC",
      locale: esDO
    });
    assert.equal(renderTemplate("{{daysSince lastPaymentDate}}", ctx), "10");
    assert.equal(renderTemplate(`{{daysUntil "${fiveDaysAhead}"}}`, ctx), "5");
  });

  it("daysSince/daysUntil yield 0 instead of NaN for an unparseable date", () => {
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC", locale: esDO });
    assert.equal(renderTemplate("{{daysSince unknownField}}", ctx), "0");
    assert.equal(renderTemplate("{{daysUntil unknownField}}", ctx), "0");
  });
});

// The reason this change exists: TTS reads a bare `9500` wrong and `9,500` right, and the
// operator should not have to learn new syntax to get it.
describe("money formatting in the render context", () => {
  const account = makeAccount({
    outstandingBalance: 9500,
    principalAmount: 12000,
    termsAmount: 1500.5,
    lastPaymentAmount: 2500,
    daysPastDue: 1200,
    missedInstallments: 4,
    termsLength: 24
  });

  it("formats every money-typed field with grouping separators", () => {
    const ctx = buildOutreachContext(account, { currency: "DOP", locale: esDO });
    assert.equal(ctx.outstandingBalance, "9,500");
    assert.equal(ctx.principalAmount, "12,000");
    assert.equal(ctx.termsAmount, "1,500.50");
    assert.equal(ctx.lastPaymentAmount, "2,500");
  });

  it("leaves count-typed fields unformatted", () => {
    const ctx = buildOutreachContext(account, { currency: "DOP", locale: esDO });
    assert.equal(ctx.daysPastDue, 1200);
    assert.equal(ctx.missedInstallments, 4);
    assert.equal(ctx.termsLength, 24);
    assert.equal(renderTemplate("{{daysPastDue}} días", ctx), "1200 días");
  });

  it("follows the workspace locale rather than a hardcoded separator", () => {
    const ctx = buildOutreachContext(account, { currency: "EUR", locale: esES });
    assert.equal(ctx.outstandingBalance, "9.500");
    assert.equal(ctx.termsAmount, "1.500,50");
  });

  it("keeps a null money field null rather than rendering '0'", () => {
    const ctx = buildOutreachContext(makeAccount({ lastPaymentAmount: null }), {
      currency: "DOP",
      locale: esDO
    });
    assert.equal(ctx.lastPaymentAmount, null);
    assert.equal(renderTemplate("[{{lastPaymentAmount}}]", ctx), "[]");
  });
});

// Formatting money-typed fields must not silently break the arithmetic and branching that
// existing templates already do on them — the settlement offer in the docs is the canary.
describe("numeric helpers over formatted amounts", () => {
  it("computes a settlement offer from a formatted balance", () => {
    const ctx = buildOutreachContext(makeAccount({ outstandingBalance: 9500 }), {
      currency: "DOP",
      locale: esDO
    });
    assert.equal(renderTemplate("{{multiply outstandingBalance 0.5}}", ctx), "4,750");
  });

  it("formats the computed amount for the workspace locale too", () => {
    const ctx = buildOutreachContext(makeAccount({ outstandingBalance: 9500 }), {
      currency: "EUR",
      locale: esES
    });
    assert.equal(renderTemplate("{{multiply outstandingBalance 0.5}}", ctx), "4.750");
  });

  it("branches on the underlying value of a formatted amount", () => {
    const ctx = buildOutreachContext(makeAccount({ outstandingBalance: 9500 }), {
      currency: "DOP",
      locale: esDO
    });
    assert.equal(
      renderTemplate("{{#if (gte outstandingBalance 1000)}}yes{{else}}no{{/if}}", ctx),
      "yes"
    );
    assert.equal(
      renderTemplate("{{#if (lt outstandingBalance 1000)}}yes{{else}}no{{/if}}", ctx),
      "no"
    );
  });

  it("compares a formatted amount to a number with eq", () => {
    const ctx = buildOutreachContext(makeAccount({ outstandingBalance: 9500 }), {
      currency: "DOP",
      locale: esDO
    });
    assert.equal(
      renderTemplate("{{#if (eq outstandingBalance 9500)}}yes{{else}}no{{/if}}", ctx),
      "yes"
    );
  });

  it("still yields 0 for a non-numeric multiply operand", () => {
    const ctx = buildOutreachContext(makeAccount({ customerSegment: "variant_A" }), {
      currency: "DOP",
      locale: esDO
    });
    assert.equal(renderTemplate("{{multiply customerSegment 2}}", ctx), "0");
  });

  it("falls back to the default locale when the context carries none", () => {
    // A context assembled by hand (an older caller, a test fixture) must not throw.
    assert.equal(renderTemplate("{{multiply balance 2}}", { balance: "4,750" }), "9,500");
  });
});

describe("digits helper", () => {
  it("spells a phone number out digit by digit", () => {
    const ctx = buildOutreachContext(makeAccount({ phone: "8092323333" }), {
      currency: "DOP",
      locale: esDO
    });
    assert.equal(renderTemplate("{{digits phone}}", ctx), "8 0 9 2 3 2 3 3 3 3");
  });

  it("drops stored formatting characters", () => {
    const ctx = buildOutreachContext(makeAccount({ phone: "+1 (809) 232-3333" }), {
      currency: "DOP",
      locale: esDO
    });
    assert.equal(renderTemplate("{{digits phone}}", ctx), "1 8 0 9 2 3 2 3 3 3 3");
  });

  it("renders empty for a missing value instead of aborting the render", () => {
    const ctx = buildOutreachContext(makeAccount({ phone: null }), {
      currency: "DOP",
      locale: esDO
    });
    assert.equal(renderTemplate("Llámenos al {{digits phone}}.", ctx), "Llámenos al .");
    assert.equal(renderTemplate("{{digits unknownField}}", ctx), "");
  });
});

describe("buildAutopilotContextLines", () => {
  it("returns an empty array for undefined context", () => {
    assert.deepEqual(buildAutopilotContextLines(undefined), []);
  });

  it("surfaces balance, terms, due status, and payment history for a past-due account", () => {
    const ctx = buildOutreachContext(
      makeAccount({
        fullName: "Juan Pérez",
        outstandingBalance: 9500,
        principalAmount: 10000,
        termsAmount: 500,
        termsFrequency: "quincenal",
        termsLength: 20,
        daysPastDue: 15,
        missedInstallments: 2,
        lastPaymentDate: new Date("2026-06-01T00:00:00Z"),
        lastPaymentAmount: 500
      }),
      { currency: "DOP", locale: esDO }
    );
    const lines = buildAutopilotContextLines(ctx);
    assert.deepEqual(lines, [
      "Cliente: Juan",
      "Saldo pendiente: 9,500 DOP",
      "Monto original del préstamo: 10,000 DOP",
      "Cuota: 500 DOP (quincenal)",
      "Plazo: 20 cuotas",
      "Días de atraso: 15",
      "Cuotas incumplidas: 2",
      "Último pago de 500 DOP: 2026-06-01"
    ]);
  });

  it("omits due-status and payment-history lines when they aren't meaningful", () => {
    const ctx = buildOutreachContext(
      makeAccount({
        outstandingBalance: 0,
        principalAmount: 0,
        termsAmount: 0,
        daysPastDue: 0,
        missedInstallments: 0,
        lastPaymentDate: null
      }),
      { currency: "USD", locale: esDO }
    );
    const lines = buildAutopilotContextLines(ctx);
    assert.deepEqual(lines, ["Cliente: María", "Saldo pendiente: 0 USD"]);
  });

  it("never includes negotiationOptions, even when set on the account", () => {
    const ctx = buildOutreachContext(
      makeAccount({ negotiationOptions: "Puede ofrecer 20% de descuento si insiste" }),
      { currency: "CRC", locale: esDO }
    );
    const lines = buildAutopilotContextLines(ctx);
    assert.ok(lines.every((l) => !l.includes("20%") && !l.includes("descuento")));
  });
});

describe("pickRandomNumber", () => {
  it("returns a number from the pool", () => {
    const pool = ["+1", "+2", "+3"];
    assert.ok(pool.includes(pickRandomNumber(pool)));
  });
});

describe("snakeToCamel", () => {
  it("converts a snake_case token to its camelCase context key", () => {
    assert.equal(snakeToCamel("first_name"), "firstName");
    assert.equal(snakeToCamel("outstanding_balance"), "outstandingBalance");
    assert.equal(snakeToCamel("days_past_due"), "daysPastDue");
  });

  it("leaves a token with no underscore unchanged", () => {
    assert.equal(snakeToCamel("currency"), "currency");
    assert.equal(snakeToCamel("firstName"), "firstName");
  });
});

describe("renderWhatsAppTemplate", () => {
  it("maps snake_case Meta placeholders to the camelCase context field, keeping parameterName literal", () => {
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC", locale: esDO });
    const { renderedBody, params } = renderWhatsAppTemplate(
      "Hola {{first_name}}, su saldo es {{outstanding_balance}} {{currency}}",
      ctx
    );
    assert.equal(renderedBody, "Hola María, su saldo es 1,500 CRC");
    assert.deepEqual(params, [
      { parameterName: "first_name", text: "María" },
      { parameterName: "outstanding_balance", text: "1,500" },
      { parameterName: "currency", text: "CRC" }
    ]);
  });

  it("returns no params for a template with no placeholders", () => {
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC", locale: esDO });
    const { renderedBody, params } = renderWhatsAppTemplate("Hola, recordatorio de pago.", ctx);
    assert.equal(renderedBody, "Hola, recordatorio de pago.");
    assert.deepEqual(params, []);
  });
});
