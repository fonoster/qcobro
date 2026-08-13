import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LOCALE,
  localeSchema,
  parseLocale,
  supportedLocales,
  updateWorkspaceSettingsSchema,
  workspaceSettingsSchema
} from "./workspaceSettings.js";

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    workspaceRef: "ws-1",
    currency: "DOP",
    timezone: "America/Santo_Domingo",
    locale: DEFAULT_LOCALE,
    ...overrides
  };
}

describe("workspace locale", () => {
  it("accepts a supported locale on the settings record", () => {
    const parsed = workspaceSettingsSchema.safeParse(makeRecord());
    assert.equal(parsed.success, true);
  });

  it("rejects an unsupported locale rather than falling back to another format", () => {
    // Amounts must never be formatted for a locale this deployment has not been verified
    // against — `9,500` and `9.500` are different numbers to a reader.
    const parsed = workspaceSettingsSchema.safeParse(makeRecord({ locale: "fr-FR" }));
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.issues.some((i) => i.path.includes("locale")));
  });

  it("rejects a missing locale", () => {
    const record = makeRecord();
    delete (record as Record<string, unknown>).locale;
    assert.equal(workspaceSettingsSchema.safeParse(record).success, false);
  });

  it("keeps the locale out of the operator-editable settings", () => {
    // There is no console control while one locale is supported, so an operator save must not
    // be able to carry one through.
    const parsed = updateWorkspaceSettingsSchema.parse({
      currency: "DOP",
      timezone: "America/Santo_Domingo",
      locale: "fr-FR"
    });
    assert.equal("locale" in parsed, false);
  });

  it("defaults to a supported locale", () => {
    assert.equal(localeSchema.safeParse(DEFAULT_LOCALE).success, true);
    assert.ok(supportedLocales.includes(DEFAULT_LOCALE));
  });

  describe("parseLocale", () => {
    it("passes a supported tag through", () => {
      assert.equal(parseLocale("es-DO"), "es-DO");
    });

    it("falls back to the default for anything else, so a read never throws", () => {
      // The column is a plain String: a row written outside the app must not take down an
      // inbound webhook mid-conversation.
      assert.equal(parseLocale("fr-FR"), DEFAULT_LOCALE);
      assert.equal(parseLocale(""), DEFAULT_LOCALE);
      assert.equal(parseLocale(null), DEFAULT_LOCALE);
      assert.equal(parseLocale(undefined), DEFAULT_LOCALE);
      assert.equal(parseLocale(42), DEFAULT_LOCALE);
    });
  });
});
