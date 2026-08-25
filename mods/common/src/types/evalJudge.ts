/** What the judge compares: an evaluator-authored expected reply against the reply an
 * agent under test actually produced, grounded by the scenario's rendered account context
 * so a reply correctly citing real account data isn't mistaken for an invented fact. */
export interface TextSimilarityRequest {
  expected: string;
  actual: string;
  /** Grounding facts the actual reply may legitimately state even when absent from `expected`
   * verbatim: the rendered account context (see `buildOutreachContext`), plus `referenceDate`
   * (today, for resolving a relative date the customer stated, e.g. "the 15th") and
   * `customerMessage` (this turn's inbound message, so a detail the customer themselves
   * supplied isn't mistaken for an invented one). */
  context?: Record<string, unknown>;
}

export interface TextSimilarityResult {
  passed: boolean;
  /** One-sentence explanation, present on both pass and fail, for CLI/report output. */
  reason?: string;
}

/**
 * Port for judging whether an actual reply matches an expected one in intent, without
 * introducing facts/entities absent from both the expected reply and the grounding
 * context — an intent-only match (à la Fonoster's VOICE_AI evaluator) would pass a reply
 * that hallucinates a bank account, since the hallucinated detail is exactly the kind of
 * "entity" an intent-only judge is told to ignore. The production adapter wraps an LLM
 * (provider from `qcobro.json` `ai`, shared with the insight generator); tests inject a
 * stub. Reached through the tRPC context like other service ports.
 */
export interface TextSimilarityJudge {
  compare(req: TextSimilarityRequest): Promise<TextSimilarityResult>;
}
