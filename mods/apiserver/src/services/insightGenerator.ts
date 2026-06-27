import {
  gestionInsightSchema,
  type AiConfig,
  type GestionInsight,
  type InsightGenerator,
  type InsightRequest
} from "@qcobro/common";

/** Render the transcript + light context into the user prompt. */
function buildPrompt(req: InsightRequest): string {
  const lines = req.transcript
    .map((l) => `${l.role === "agent" ? "Agente" : "Cliente"}: ${l.text}`)
    .join("\n");
  const ctx: string[] = [];
  if (req.context?.customerName) ctx.push(`Cliente: ${req.context.customerName}`);
  if (typeof req.context?.outstandingBalance === "number")
    ctx.push(`Saldo pendiente: ${req.context.outstandingBalance}`);
  const language = req.language || "es";
  return [
    "Analiza la siguiente conversación de cobranza (puede ser una llamada, un SMS o un correo).",
    `Devuelve SOLO un objeto JSON con las claves: aiSummary, aiSentiment, aiDebtReason, aiResult, aiNextStep.`,
    `aiSentiment debe ser uno de: POSITIVE, NEUTRAL, NEGATIVE, HOSTILE.`,
    `Escribe todos los campos de texto en el idioma: ${language}.`,
    ctx.length ? `Contexto — ${ctx.join(" · ")}` : "",
    "Conversación:",
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

/** Offline provider: a deterministic, plausible analysis with no key/network/cost. */
function mockAnalyze(req: InsightRequest): GestionInsight {
  const customerLines = req.transcript.filter((l) => l.role === "customer").map((l) => l.text);
  const last = customerLines[customerLines.length - 1] ?? "";
  const lc = last.toLowerCase();
  const positive = /(pag|sí|claro|de acuerdo|puedo)/.test(lc);
  const negative = /(no puedo|no quiero|imposible|reclamo)/.test(lc);
  return {
    aiSummary: `Resumen automático: el cliente ${
      positive
        ? "muestra disposición a regularizar su saldo"
        : "fue contactado sobre su saldo pendiente"
    }. Última intervención: "${last || "sin respuesta registrada"}".`,
    aiSentiment: negative ? "NEGATIVE" : positive ? "POSITIVE" : "NEUTRAL",
    aiDebtReason: "No determinado a partir de la conversación.",
    aiResult: positive ? "Disposición a pagar" : "Sin compromiso firme",
    aiNextStep: positive ? "Enviar enlace de pago y dar seguimiento." : "Reintentar el contacto."
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
