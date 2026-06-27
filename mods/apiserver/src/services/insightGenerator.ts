import {
  gestionInsightSchema,
  type AiConfig,
  type GestionInsight,
  type InsightGenerator,
  type InsightRequest
} from "@qcobro/common";

/**
 * Render the transcript + light context into the user prompt. Instructions are written
 * in English (internal analysis language); the model is told to write the output fields
 * in the same language the customer used, so the analysis matches the conversation
 * regardless of deployment language. `req.language` is only a fallback hint when the
 * conversation language can't be inferred.
 */
function buildPrompt(req: InsightRequest): string {
  const lines = req.transcript
    .map((l) => `${l.role === "agent" ? "Agent" : "Customer"}: ${l.text}`)
    .join("\n");
  const ctx: string[] = [];
  if (req.context?.customerName) ctx.push(`Customer: ${req.context.customerName}`);
  if (typeof req.context?.outstandingBalance === "number")
    ctx.push(`Outstanding balance: ${req.context.outstandingBalance}`);
  const fallback = req.language
    ? ` If the language cannot be determined, use "${req.language}".`
    : "";
  return [
    "Analyze the following debt-collection conversation (it may be a call, SMS, or email).",
    "Return ONLY a JSON object with the keys: aiSummary, aiSentiment, aiDebtReason, aiResult, aiNextStep.",
    "aiSentiment must be one of: POSITIVE, NEUTRAL, NEGATIVE, HOSTILE.",
    `Write every text field in the same language the customer used in the conversation below.${fallback}`,
    ctx.length ? `Context — ${ctx.join(" · ")}` : "",
    "Conversation:",
    lines
  ]
    .filter(Boolean)
    .join("\n");
}

/** Extract the first JSON object from a model response (handles ```json fences). */
function parseInsight(text: string): GestionInsight {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response");
  return gestionInsightSchema.parse(JSON.parse(raw.slice(start, end + 1)));
}

/**
 * Offline provider: a deterministic, plausible analysis with no key/network/cost.
 * Output is in English (internal-analysis language); the heuristic recognizes both
 * English and Spanish cues since it can't run real language detection.
 */
function mockAnalyze(req: InsightRequest): GestionInsight {
  const customerLines = req.transcript.filter((l) => l.role === "customer").map((l) => l.text);
  const last = customerLines[customerLines.length - 1] ?? "";
  const lc = last.toLowerCase();
  const positive = /(pag|pay|sí|yes|claro|sure|de acuerdo|agree|puedo|can)/.test(lc);
  const negative =
    /(no puedo|can'?t|cannot|won'?t|no quiero|imposible|impossible|reclamo|dispute)/.test(lc);
  return {
    aiSummary: `Automated summary: the customer ${
      positive
        ? "shows willingness to settle their balance"
        : "was contacted about their outstanding balance"
    }. Last message: "${last || "no response recorded"}".`,
    aiSentiment: negative ? "NEGATIVE" : positive ? "POSITIVE" : "NEUTRAL",
    aiDebtReason: "Not determined from the conversation.",
    aiResult: positive ? "Willing to pay" : "No firm commitment",
    aiNextStep: positive ? "Send payment link and follow up." : "Retry contact."
  };
}

async function googleAnalyze(cfg: NonNullable<AiConfig>, prompt: string): Promise<GestionInsight> {
  const apiKey = cfg.apiKey ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Google LLM API key not configured (ai.apiKey or GOOGLE_API_KEY)");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: cfg.temperature,
        maxOutputTokens: cfg.maxTokens,
        responseMimeType: "application/json",
        // gemini-2.5-* are "thinking" models; disable thinking so the token budget
        // goes to the JSON answer instead of being consumed by reasoning.
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });
  if (!res.ok) throw new Error(`Google GenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseInsight(text);
}

/**
 * Builds the insight generator from the `ai` config, or null when AI insights are
 * absent/disabled (callers then skip generation). Providers are reached over REST;
 * `mock` is offline. openai/anthropic adapters are not yet implemented.
 */
export function createInsightGenerator(ai: AiConfig): InsightGenerator | null {
  if (!ai || !ai.enabled) return null;
  return {
    async analyze(req: InsightRequest): Promise<GestionInsight> {
      switch (ai.provider) {
        case "mock":
          return mockAnalyze(req);
        case "google":
          return googleAnalyze(ai, buildPrompt(req));
        default:
          throw new Error(`Insight provider "${ai.provider}" adapter is not implemented yet`);
      }
    }
  };
}
