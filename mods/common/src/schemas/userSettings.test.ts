import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  themeSchema,
  updateUserThemeSchema,
  updateUserLanguageSchema,
  userSettingsSchema
} from "./userSettings.js";

function makeRecord(overrides: Record<string, unknown> = {}) {
  return { userRef: "u-1", language: "es", theme: "system", ...overrides };
}

describe("user appearance preference", () => {
  it("accepts the three supported theme values", () => {
    for (const theme of ["system", "light", "dark"]) {
      assert.equal(themeSchema.safeParse(theme).success, true, theme);
    }
  });

  it("rejects an unsupported theme value", () => {
    assert.equal(themeSchema.safeParse("sepia").success, false);
    assert.equal(updateUserThemeSchema.safeParse({ theme: "sepia" }).success, false);
  });

  it("requires theme on the settings record", () => {
    assert.equal(userSettingsSchema.safeParse(makeRecord()).success, true);
    const record = makeRecord();
    delete (record as Record<string, unknown>).theme;
    assert.equal(userSettingsSchema.safeParse(record).success, false);
  });

  it("keeps the language update input independent of theme", () => {
    // Appearance and language are separate one-field mutations; neither carries the other.
    assert.equal(updateUserLanguageSchema.safeParse({ language: "en" }).success, true);
    assert.equal(
      updateUserThemeSchema.safeParse({ theme: "dark", language: "en" }).success,
      true,
      "extra keys are stripped, not rejected"
    );
  });
});
