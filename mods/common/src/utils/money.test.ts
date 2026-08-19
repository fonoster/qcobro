import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, formatWorkspaceMoney, toNumber } from "./money.js";
import { DEFAULT_LOCALE, type Locale } from "../schemas/workspaceSettings.js";

// es-DO is the only supported locale today. es-ES is exercised through a cast to prove the
// separator handling is discovered from Intl rather than hardcoded to a comma — the day a
// second market is added, these assertions are what catch a regression.
const esDO = "es-DO" as Locale;
const esES = "es-ES" as Locale;

describe("formatMoney", () => {
  it("groups thousands for the workspace locale", () => {
    assert.equal(formatMoney(9500, esDO), "9,500");
    assert.equal(formatMoney(9500, esES), "9.500");
  });

  it("adds two fraction digits only when the amount has a fractional part", () => {
    assert.equal(formatMoney(9500, esDO), "9,500");
    assert.equal(formatMoney(9500.5, esDO), "9,500.50");
    assert.equal(formatMoney(9500.55, esDO), "9,500.55");
  });

  it("leaves amounts below the grouping threshold alone", () => {
    assert.equal(formatMoney(0, esDO), "0");
    assert.equal(formatMoney(999, esDO), "999");
  });

  it("formats negative amounts", () => {
    assert.equal(formatMoney(-9500, esDO), "-9,500");
  });

  it("renders a non-finite amount as empty rather than 'NaN'", () => {
    assert.equal(formatMoney(NaN, esDO), "");
    assert.equal(formatMoney(Infinity, esDO), "");
  });
});

describe("formatWorkspaceMoney", () => {
  it("shows no decimals for a round amount", () => {
    assert.equal(formatWorkspaceMoney(32000, esDO, "DOP"), "RD$32,000");
  });

  it("shows two decimals for a fractional amount", () => {
    assert.equal(formatWorkspaceMoney(32000.5, esDO, "DOP"), "RD$32,000.50");
  });

  it("uses the workspace locale's grouping and symbol, not the bare currency code", () => {
    const rendered = formatWorkspaceMoney(32000, esDO, "DOP");
    assert.equal(rendered, "RD$32,000");
    assert.notEqual(rendered, "32.000 DOP");
  });

  it("formats DEFAULT_LOCALE the same as es-DO, for the loading/unset fallback", () => {
    assert.equal(
      formatWorkspaceMoney(32000, DEFAULT_LOCALE, "DOP"),
      formatWorkspaceMoney(32000, esDO, "DOP")
    );
  });

  it("renders a non-finite amount as empty rather than 'NaN'", () => {
    assert.equal(formatWorkspaceMoney(NaN, esDO, "DOP"), "");
    assert.equal(formatWorkspaceMoney(Infinity, esDO, "DOP"), "");
  });
});

describe("toNumber", () => {
  it("passes numbers through", () => {
    assert.equal(toNumber(9500, esDO), 9500);
    assert.equal(toNumber(0, esDO), 0);
  });

  it("parses an amount formatted for the same locale", () => {
    assert.equal(toNumber("9,500", esDO), 9500);
    assert.equal(toNumber("9,500.50", esDO), 9500.5);
  });

  it("reads separators per locale rather than assuming a comma", () => {
    assert.equal(toNumber("9.500", esES), 9500);
    assert.equal(toNumber("9.500,50", esES), 9500.5);
  });

  it("round-trips whatever formatMoney produced", () => {
    for (const locale of [esDO, esES]) {
      for (const value of [0, 999, 9500, 9500.5, 1234567.89, -9500]) {
        assert.equal(toNumber(formatMoney(value, locale), locale), value);
      }
    }
  });

  it("returns NaN for values that are not amounts", () => {
    assert.ok(Number.isNaN(toNumber("variant_A", esDO)));
    assert.ok(Number.isNaN(toNumber("", esDO)));
    assert.ok(Number.isNaN(toNumber("   ", esDO)));
    assert.ok(Number.isNaN(toNumber(undefined, esDO)));
  });
});
