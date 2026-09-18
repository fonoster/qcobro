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
      assert.match(issue?.message ?? "", /REPLACE/);
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
      "mode",
      "portfolioId",
      "rows"
    ]);
  });
});
