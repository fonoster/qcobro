import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, buildOutreachContext, pickRandomNumber } from "./outreach.js";
import type { PortfolioAccountRecord } from "../types/portfolios.js";

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
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC" });
    const out = renderTemplate(
      "Hola {{firstName}}, su saldo es {{outstandingBalance}} {{currency}}",
      ctx
    );
    assert.equal(out, "Hola María, su saldo es 1500 CRC");
  });

  it("renders a missing field as empty without throwing", () => {
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC" });
    const out = renderTemplate("Hola {{firstName}} {{unknownField}}!", ctx);
    assert.equal(out, "Hola María !");
  });

  it("derives firstName from the first token of fullName", () => {
    const ctx = buildOutreachContext(makeAccount({ fullName: "Juan Carlos Pérez" }), {
      currency: "USD"
    });
    assert.equal(ctx.firstName, "Juan");
  });

  it("derives isDue from daysPastDue", () => {
    const overdue = buildOutreachContext(makeAccount({ daysPastDue: 30 }), { currency: "CRC" });
    const current = buildOutreachContext(makeAccount({ daysPastDue: 0 }), { currency: "CRC" });
    assert.equal(overdue.isDue, true);
    assert.equal(current.isDue, false);
  });

  it("branches a template on the isDue conditional", () => {
    const tpl = "{{#if isDue}}Su pago está vencido{{else}}Gracias por estar al día{{/if}}";
    const overdue = renderTemplate(
      tpl,
      buildOutreachContext(makeAccount({ daysPastDue: 5 }), { currency: "CRC" })
    );
    const current = renderTemplate(
      tpl,
      buildOutreachContext(makeAccount({ daysPastDue: 0 }), { currency: "CRC" })
    );
    assert.equal(overdue, "Su pago está vencido");
    assert.equal(current, "Gracias por estar al día");
  });

  it("multiplies two numeric fields with the multiply helper", () => {
    const ctx = buildOutreachContext(makeAccount({ outstandingBalance: 1000 }), {
      currency: "CRC"
    });
    const out = renderTemplate("Oferta: {{multiply outstandingBalance 0.5}} {{currency}}", ctx);
    assert.equal(out, "Oferta: 500 CRC");
  });

  it("multiply helper yields 0 instead of NaN for non-numeric operands", () => {
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC" });
    const out = renderTemplate("{{multiply unknownField 2}}", ctx);
    assert.equal(out, "0");
  });

  it("a reference to an unregistered helper surfaces as a marker instead of throwing", () => {
    const ctx = buildOutreachContext(makeAccount(), { currency: "CRC" });
    assert.doesNotThrow(() => renderTemplate("{{notAHelper firstName}}", ctx));
    const out = renderTemplate("{{notAHelper firstName}}", ctx);
    assert.match(out, /^\[Error de plantilla:.*notAHelper.*\]$/);
  });
});

describe("pickRandomNumber", () => {
  it("returns a number from the pool", () => {
    const pool = ["+1", "+2", "+3"];
    assert.ok(pool.includes(pickRandomNumber(pool)));
  });
});
