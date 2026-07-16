import {
  buildAutopilotContextLines,
  emailAutopilotDecisionSchema,
  type AiConfig,
  type EmailAutopilot,
  type EmailAutopilotDecision,
  type EmailAutopilotRequest
} from "@qcobro/common";

/** Build the conversational thread into the decision prompt. */
function buildPrompt(req: EmailAutopilotRequest): string {
  const lines = req.thread
    .map((m) => `${m.direction === "outbound" ? "Agente" : "Cliente"}: ${m.body}`)
    .join("\n");
  const ctx = buildAutopilotContextLines(req.context);
  const language = req.language || "es";
  return [
    req.systemPrompt,
    "",
    "Eres el autopiloto de cobranza por WhatsApp. Decide la siguiente acción para el hilo.",
    "Devuelve SOLO un objeto JSON con las claves: action, replyBody, outcome, objective.",
    "action ∈ reply | ignore | resolve | escalate.",
    "Cuando action = reply, replyBody es el cuerpo del mensaje de texto libre (en el idioma del cliente).",
    "Si el cliente promete pagar, usa outcome = PAYMENT_PROMISE y objective { type, amount, dueDate }.",
    "Si el cliente pide que no le contacten (opt-out), usa outcome = OPT_OUT y action = resolve.",
    "Si el asunto no corresponde / está resuelto, usa resolve. Si requiere intervención humana, escalate.",
    "Usa el Contexto para responder preguntas básicas del cliente sobre su préstamo (saldo, cuota, " +
      "plazo, atraso, último pago). No inventes datos que no estén en el Contexto.",
    `Idioma de la respuesta: ${language}.`,
    ctx.length ? `Contexto — ${ctx.join(" · ")}` : "",
    "Hilo:",
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

function mockDecide(req: EmailAutopilotRequest): EmailAutopilotDecision {
  const inbound = req.thread.filter((m) => m.direction === "inbound");
  const last = inbound[inbound.length - 1]?.body ?? "";
  const lc = last.toLowerCase();
  if (/(stop|no contactar|baja|dar de baja|no quiero|no molest)/.test(lc)) {
    return { action: "resolve", outcome: "OPT_OUT" };
  }
  if (/(pag|abonar|transferir|deposit|el viernes|la semana|mañana)/.test(lc)) {
    return {
      action: "reply",
      replyBody:
        "Gracias por su respuesta. Registramos su compromiso de pago y le compartimos los detalles para coordinarlo. Quedamos atentos.",
      outcome: "PAYMENT_PROMISE",
      objective: { type: "PAYMENT_PROMISE" }
    };
  }
  if (/(no es|equivocad|no soy|número|no escrib|no contact)/.test(lc)) {
    return { action: "resolve", outcome: "WRONG_NUMBER" };
  }
  if (/(reclamo|abogad|demanda|queja)/.test(lc)) {
    return { action: "escalate", outcome: "OTHER" };
  }
  return {
    action: "reply",
    replyBody:
      "Gracias por escribirnos. ¿Podría indicarnos cuándo podría regularizar su saldo para coordinar el pago?"
  };
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
    })
  });
  if (!res.ok) throw new Error(`Google GenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return parseDecision(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
}

/**
 * Builds the WhatsApp autopilot from the `ai` config. Returns an `EmailAutopilot`
 * (same decision interface — the difference is the WhatsApp-specific prompt wording).
 * Falls back to the deterministic mock when AI is absent/disabled.
 */
export function createWhatsAppAutopilot(ai: AiConfig): EmailAutopilot {
  return {
    async decide(req: EmailAutopilotRequest): Promise<EmailAutopilotDecision> {
      if (!ai || !ai.enabled || ai.provider === "mock") return mockDecide(req);
      if (ai.provider === "google") return googleDecide(ai, buildPrompt(req));
      throw new Error(
        `WhatsApp autopilot provider "${ai.provider}" adapter is not implemented yet`
      );
    }
  };
}
