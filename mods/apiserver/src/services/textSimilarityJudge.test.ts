import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTextSimilarityJudge } from "./textSimilarityJudge.js";

describe("createTextSimilarityJudge", () => {
  it("falls back to the offline mock provider when no ai config is present", async () => {
    const judge = createTextSimilarityJudge(undefined);
    const result = await judge.compare({ expected: "Gracias.", actual: "Gracias, confirmado." });
    assert.equal(result.passed, true);
  });

  it("mock provider fails on texts with no overlap", async () => {
    const judge = createTextSimilarityJudge(undefined);
    const result = await judge.compare({
      expected: "Gracias.",
      actual: "Transfiera a la cuenta 000-111-222."
    });
    assert.equal(result.passed, false);
  });

  it("rejects an unimplemented provider", async () => {
    const judge = createTextSimilarityJudge({
      enabled: true,
      provider: "openai",
      model: "gpt-4o",
      temperature: 0,
      maxTokens: 600,
      generation: "onDemand"
    });
    await assert.rejects(
      judge.compare({ expected: "a", actual: "b" }),
      /adapter is not implemented yet/
    );
  });
});
