import type {
  AiConfig,
  TextSimilarityJudge,
  TextSimilarityRequest,
  TextSimilarityResult
} from "@qcobro/common";
import { LLM_TIMEOUT_MS } from "./httpTimeouts.js";

/**
 * The judge's instructions: match VOICE_AI's evaluator in checking overall intent, but —
 * unlike Fonoster's `textSimilaryPrompt` (which explicitly tells the judge to ignore
 * entities) — also fail on any fact/entity the actual reply introduces that isn't grounded
 * in either the expected reply or the account context. An intent-only judge would happily
 * pass a reply that hallucinates a bank account, since the hallucinated detail is exactly
 * the kind of "entity" it's told to ignore.
 */
const JUDGE_PROMPT = [
  "You are a strict evaluator for a debt-collection agent's reply to a customer.",
  "",
  "You are given:",
  "- EXPECTED: a reference reply an evaluator wrote by hand, showing acceptable intent and content.",
  "- ACTUAL: the reply the agent under test actually produced.",
  "- CONTEXT: known-true facts the agent may legitimately mention even when they do not appear",
  "  in EXPECTED — account facts (name, balances, dates, terms), today's reference date, and",
  "  the customer's own message this turn. A detail in ACTUAL that is a direct restatement or",
  "  straightforward derivation of something in CONTEXT — e.g. resolving a date the customer",
  '  gave relatively ("the 15th") into an absolute one using the reference date — is grounded,',
  "  not invented.",
  "",
  "Task:",
  "1. Compare the INTENT of ACTUAL to EXPECTED, ignoring wording/phrasing/length differences —",
  "   do they accomplish the same thing?",
  "2. Check ACTUAL for any fact, entity, or number (amounts, dates, account/reference/bank",
  "   numbers, phone numbers, names, addresses, etc.) that is NOT present in EXPECTED and NOT",
  "   grounded in CONTEXT. Any such invented detail is a FAIL regardless of intent match — this",
  "   check matters more than intent matching.",
  "",
  'Respond with ONLY a JSON object: {"passed": true|false, "reason": "<one short sentence>"}.'
].join("\n");

function buildUserContent(req: TextSimilarityRequest): string {
  const lines = [`EXPECTED: ${req.expected}`, `ACTUAL: ${req.actual}`];
  if (req.context && Object.keys(req.context).length > 0) {
    lines.push(`CONTEXT: ${JSON.stringify(req.context)}`);
  }
  return lines.join("\n");
}

/** Extract the first JSON object from a model response (handles ```json fences). */
function parseJudgeResult(text: string): TextSimilarityResult {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in judge response");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as { passed?: unknown; reason?: unknown };
  return {
    passed: parsed.passed === true,
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined
  };
}

/**
 * Offline provider: a deterministic heuristic (normalized substring overlap) — not real
 * entity-hallucination detection, just enough for local dev/tests to run with no key and
 * no network/cost. Callers that need to exercise judge grading logic should inject a stub
 * `TextSimilarityJudge` instead of relying on this heuristic's exact behavior.
 */
function mockCompare(req: TextSimilarityRequest): TextSimilarityResult {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim();
  const expected = normalize(req.expected);
  const actual = normalize(req.actual);
  const passed = actual.includes(expected) || expected.includes(actual);
  return {
    passed,
    reason: passed
      ? "Mock judge: normalized texts overlap."
      : "Mock judge: normalized texts do not overlap (offline heuristic, not a real similarity check)."
  };
}

async function googleCompare(
  cfg: NonNullable<AiConfig>,
  req: TextSimilarityRequest
): Promise<TextSimilarityResult> {
  const apiKey = cfg.apiKey ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Google LLM API key not configured (ai.apiKey or GOOGLE_API_KEY)");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: JUDGE_PROMPT }] },
      contents: [{ parts: [{ text: buildUserContent(req) }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 200,
        responseMimeType: "application/json",
        // gemini-2.5-* are "thinking" models; disable thinking so the token budget
        // goes to the JSON answer instead of being consumed by reasoning.
        thinkingConfig: { thinkingBudget: 0 }
      }
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`Google GenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseJudgeResult(text);
}

/**
 * Builds the text-similarity judge from the `ai` config — the same deployment-wide LLM
 * config the insight generator uses, reused here for a different purpose. Unlike
 * `createInsightGenerator`, this is never null: evals are an explicit, deliberate action
 * (a CLI/console run), not a background process, so an absent/disabled `ai` config falls
 * back to the offline mock provider rather than making judge-based SIMILAR assertions
 * unusable. openai/anthropic adapters are not yet implemented, matching the insight
 * generator's current provider support.
 */
export function createTextSimilarityJudge(ai: AiConfig): TextSimilarityJudge {
  return {
    async compare(req: TextSimilarityRequest): Promise<TextSimilarityResult> {
      if (!ai || ai.provider === "mock") return mockCompare(req);
      if (ai.provider === "google") return googleCompare(ai, req);
      throw new Error(`Judge provider "${ai.provider}" adapter is not implemented yet`);
    }
  };
}
