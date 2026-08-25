import {
  buildAutopilotContextLines,
  emailAutopilotDecisionSchema,
  type AiConfig,
  type EmailAutopilot,
  type EmailAutopilotDecision,
  type EmailAutopilotRequest,
  type EmailThreadMessage,
  type TranscriptLine
} from "@qcobro/common";
import { LLM_TIMEOUT_MS } from "./httpTimeouts.js";

/**
 * Maps a Voz IA transcript onto the shared thread shape so the EMAIL/WhatsApp decision
 * contract (`EmailAutopilotRequest.thread`) can be reused unchanged for voice — the
 * inverse of the email↔transcript mapping `generateGestionInsight.ts` does for insights.
 */
export function transcriptToThread(transcript: TranscriptLine[]): EmailThreadMessage[] {
  return transcript.map((line) => ({
    direction: line.role === "customer" ? "inbound" : "outbound",
    from: line.role,
    at: "",
    body: line.text
  }));
}

/** Render the full call transcript + light context + the agent's system prompt into the prompt. */
function buildPrompt(req: EmailAutopilotRequest): string {
  const lines = req.thread
    .map((m) => `${m.direction === "outbound" ? "Agente" : "Cliente"}: ${m.body}`)
    .join("\n");
  const ctx = buildAutopilotContextLines(req.context);
  const language = req.language || "es";
  return [
    req.systemPrompt,
    "",
    "Eres el autopiloto de cobranza por voz (Voz IA). La llamada ya terminó — analiza la " +
      "transcripción completa y decide el resultado de la gestión.",
    "Devuelve SOLO un objeto JSON con las claves: action, resultado, objective.",
    "action ∈ ignore | resolve | escalate. La llamada ya terminó: NUNCA uses reply.",
    "Si el cliente prometió pagar durante la llamada, usa resultado = PAYMENT_PROMISE y " +
      "objective { amount, dueDate }.",
    req.referenceDate ? `Hoy es ${req.referenceDate} (formato YYYY-MM-DD).` : "",
    "objective.dueDate DEBE ser una fecha absoluta en formato YYYY-MM-DD. Convierte expresiones " +
      'relativas ("mañana", "el viernes", "la próxima semana") a esa fecha usando la fecha de hoy. ' +
      "Si el cliente no indica una fecha concreta, omite dueDate.",
    "Usa resolve si el asunto quedó resuelto o no aplica ningún resultado especial. Usa escalate " +
      "si se requiere intervención humana (reclamo, disputa, amenaza legal).",
    "Usa el Contexto para interpretar preguntas del cliente sobre su préstamo (saldo, cuota, " +
      "plazo, atraso, último pago). No inventes datos que no estén en el Contexto.",
    `Idioma de la transcripción: ${language}.`,
    ctx.length ? `Contexto — ${ctx.join(" · ")}` : "",
    "Transcripción de la llamada:",
    lines
  ]
    .filter(Boolean)
    .join("\n");
}

/** Extract the first JSON object from a model response (handles ```json fences). */
function parseDecision(text: string): EmailAutopilotDecision {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response");
  return emailAutopilotDecisionSchema.parse(JSON.parse(raw.slice(start, end + 1)));
}

/** Offline provider: a deterministic decision from the customer's transcript lines (no key/cost). */
function mockDecide(req: EmailAutopilotRequest): EmailAutopilotDecision {
  const inbound = req.thread.filter((m) => m.direction === "inbound");
  const all = inbound
    .map((m) => m.body)
    .join(" ")
    .toLowerCase();
  if (/(pag|abonar|transferir|deposit|el viernes|la semana|mañana)/.test(all)) {
    return { action: "resolve", resultado: "PAYMENT_PROMISE" };
  }
  if (/(no es|equivocad|no soy|número|baja|no escrib|no contact)/.test(all)) {
    return { action: "resolve", resultado: "WRONG_PARTY" };
  }
  if (/(reclamo|abogad|demanda|queja)/.test(all)) {
    // escalate writes nothing beyond suppressing the auto-reply — it carries no resultado.
    return { action: "escalate" };
  }
  return { action: "resolve" };
}

async function googleDecide(
  cfg: NonNullable<AiConfig>,
  prompt: string
): Promise<EmailAutopilotDecision> {
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
        thinkingConfig: { thinkingBudget: 0 }
      }
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`Google GenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return parseDecision(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
}

/**
 * Builds the Voz IA autopilot decision step from the `ai` config. Unlike EMAIL/WhatsApp,
 * this runs once per call (on `conversation.ended`, over the full final transcript) rather
 * than per inbound turn — QCobro doesn't observe individual live turns of a Voz IA call.
 * When AI is absent/disabled it falls back to the deterministic offline decider so the
 * channel still works in dev/tests with no key. Mirrors {@link createEmailAutopilot}'s
 * provider set (mock + google over REST).
 */
export function createVoiceAutopilot(ai: AiConfig): EmailAutopilot {
  return {
    async decide(req: EmailAutopilotRequest): Promise<EmailAutopilotDecision> {
      if (!ai || !ai.enabled || ai.provider === "mock") return mockDecide(req);
      if (ai.provider === "google") return googleDecide(ai, buildPrompt(req));
      throw new Error(`Voice autopilot provider "${ai.provider}" adapter is not implemented yet`);
    }
  };
}
