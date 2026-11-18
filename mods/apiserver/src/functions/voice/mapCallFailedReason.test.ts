import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapCallFailedReason } from "./mapCallFailedReason.js";

describe("mapCallFailedReason", () => {
  const table: [string, string][] = [
    ["busy", "BUSY"],
    ["no_answer", "NO_ANSWER"],
    ["rejected", "REJECTED"],
    ["app_unreachable", "PROVIDER_ERROR"],
    ["node_error", "PROVIDER_ERROR"],
    ["removed", "OUTCOME_UNKNOWN"],
    ["something_new", "OUTCOME_UNKNOWN"]
  ];

  for (const [reason, expected] of table) {
    it(`maps ${reason} to ${expected}`, () => {
      assert.equal(mapCallFailedReason(reason), expected);
    });
  }
});
