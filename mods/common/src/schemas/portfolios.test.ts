import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { syncAccountsInputSchema } from "./portfolios.js";

const ROW = { externalId: "C001", fullName: "Ana García", outstandingBalance: 1000 };

describe("syncAccountsInputSchema", () => {
  it("accepts an empty batch in REPLACE mode (a snapshot with no accounts empties the portfolio)", () => {
    const result = syncAccountsInputSchema.safeParse({
      portfolioId: "p1",
      mode: "REPLACE",
      rows: []
    });
    assert.equal(result.success, true);
    assert.deepEqual(result.data?.rows, []);
  });

  for (const mode of ["APPEND_ONLY", "UPDATE_EXISTING"] as const) {
    it(`rejects an empty batch in ${mode} mode with an issue on rows`, () => {
      const result = syncAccountsInputSchema.safeParse({ portfolioId: "p1", mode, rows: [] });
      assert.equal(result.success, false);
      const issue = result.error?.issues[0];
      assert.deepEqual(issue?.path, ["rows"]);
      assert.equal(issue?.code, "too_small");
      assert.equal(
        issue?.message,
        `rows and exits must not both be empty in ${mode} mode (only REPLACE accepts an empty batch)`
      );
    });

    it(`accepts a non-empty batch in ${mode} mode`, () => {
      assert.equal(
        syncAccountsInputSchema.safeParse({ portfolioId: "p1", mode, rows: [ROW] }).success,
        true
      );
    });
  }

  it("still exposes the object shape (the MCP tool registers syncAccountsInputSchema.shape)", () => {
    assert.deepEqual(Object.keys(syncAccountsInputSchema.shape).sort(), [
      "exits",
      "mode",
      "portfolioId",
      "rows"
    ]);
  });

  it("defaults exits to an empty array", () => {
    const result = syncAccountsInputSchema.safeParse({
      portfolioId: "p1",
      mode: "REPLACE",
      rows: [ROW]
    });
    assert.deepEqual(result.data?.exits, []);
  });

  it("leaves termsAmount and missedInstallments undefined when a row omits them (never 0)", () => {
    const result = syncAccountsInputSchema.safeParse({
      portfolioId: "p1",
      mode: "REPLACE",
      rows: [ROW]
    });
    assert.equal(result.data?.rows[0]?.termsAmount, undefined);
    assert.equal(result.data?.rows[0]?.missedInstallments, undefined);
  });

  for (const mode of ["APPEND_ONLY", "UPDATE_EXISTING"] as const) {
    it(`accepts an exits-only batch in ${mode} mode`, () => {
      const result = syncAccountsInputSchema.safeParse({
        portfolioId: "p1",
        mode,
        rows: [],
        exits: [{ externalId: "C9", reason: "WRITTEN_OFF" }]
      });
      assert.equal(result.success, true);
    });
  }

  it("accepts a CURED exit with missedInstallments and termsAmount", () => {
    const result = syncAccountsInputSchema.safeParse({
      portfolioId: "p1",
      mode: "UPDATE_EXISTING",
      rows: [],
      exits: [{ externalId: "C9", reason: "CURED", missedInstallments: 3, termsAmount: 1500 }]
    });
    assert.equal(result.success, true);
  });

  function issuesFor(exits: unknown[], rows: unknown[] = []) {
    const result = syncAccountsInputSchema.safeParse({
      portfolioId: "p1",
      mode: "UPDATE_EXISTING",
      rows,
      exits
    });
    assert.equal(result.success, false);
    return result.error!.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  }

  for (const reason of ["CURED", "PAID_OFF"] as const) {
    it(`requires missedInstallments and termsAmount on a ${reason} exit`, () => {
      assert.deepEqual(issuesFor([{ externalId: "C9", reason }]), [
        {
          path: "exits.0.missedInstallments",
          message: "required when reason is CURED or PAID_OFF"
        },
        { path: "exits.0.termsAmount", message: "required when reason is CURED or PAID_OFF" }
      ]);
    });

    it(`rejects zero values on a ${reason} exit`, () => {
      assert.deepEqual(
        issuesFor([{ externalId: "C9", reason, missedInstallments: 0, termsAmount: 0 }]),
        [
          { path: "exits.0.missedInstallments", message: "must be greater than 0" },
          { path: "exits.0.termsAmount", message: "must be greater than 0" }
        ]
      );
    });
  }

  it("rejects an unknown reason, including UNKNOWN", () => {
    for (const reason of ["UNKNOWN", "PAGADO"]) {
      assert.deepEqual(issuesFor([{ externalId: "C9", reason }]), [
        {
          path: "exits.0.reason",
          message: "reason must be one of CURED, PAID_OFF, WRITTEN_OFF, OTHER"
        }
      ]);
    }
  });

  it("rejects an externalId that appears in both rows and exits", () => {
    assert.deepEqual(issuesFor([{ externalId: "C001", reason: "OTHER" }], [ROW]), [
      { path: "exits.0.externalId", message: 'externalId "C001" appears in both rows and exits' }
    ]);
  });

  it("rejects an externalId that appears twice in exits", () => {
    assert.deepEqual(
      issuesFor([
        { externalId: "C9", reason: "OTHER" },
        { externalId: "C9", reason: "WRITTEN_OFF" }
      ]),
      [{ path: "exits.1.externalId", message: 'externalId "C9" appears twice in exits' }]
    );
  });
});
