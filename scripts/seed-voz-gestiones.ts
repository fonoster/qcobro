/**
 * Seed a few Voz IA gestiones so the detalle card can be reviewed without placing a
 * real call. Drives the REAL endpoints end-to-end:
 *
 *   1. POST /api/contact-logs       — the dispatch-style record (channelData.providerRef)
 *   2. POST /api/voice/events       — the autopilot conversation.ended webhook, which
 *                                     correlates by call ref and attaches transcript +
 *                                     recording + duration.
 *
 * So this doubles as a manual test of the voice webhook. Reads the API port from
 * qcobro.json and the DB connection from your environment (same DATABASE_URL the server
 * uses). Run it with the dev stack up:
 *
 *   npx tsx scripts/seed-voz-gestiones.ts [portfolioAccountId]
 *
 * With no argument it uses the first non-archived account it finds and prints which
 * workspace / cartera to look in. Delete this file once Voz IA is verified.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../mods/apiserver/src/db.ts";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "qcobro.json"), "utf8"));
const BASE = `http://localhost:${config.apiserver?.port ?? 3000}`;

// A short, publicly hosted sample so the player actually plays in the browser.
const SAMPLE_RECORDING = "https://download.samplelib.com/mp3/sample-6s.mp3";

type Scenario = {
  outcome: string;
  intentMetadata?: Record<string, unknown>;
  ai: {
    aiSummary: string;
    aiSentiment: string;
    aiDebtReason?: string;
    aiResult?: string;
    aiNextStep?: string;
  };
  transcript: { ai?: string; human?: string }[];
  durationSeconds: number;
};

const SCENARIOS: Scenario[] = [
  {
    outcome: "PAYMENT_PROMISE",
    intentMetadata: { promisedAmount: 4820, promisedDate: daysFromNow(4) },
    ai: {
      aiSummary:
        "El cliente reconoce la deuda y se compromete a pagar el saldo completo el viernes. Tono cooperativo durante toda la llamada.",
      aiSentiment: "POSITIVE",
      aiDebtReason: "Falta de liquidez temporal",
      aiResult: "Promesa de pago",
      aiNextStep: "Enviar enlace de pago por SMS"
    },
    transcript: [
      { ai: "Buenas tardes, le llamo de QCobro respecto a su cuenta. ¿Tiene un momento?" },
      { human: "Sí, dígame." },
      { ai: "Su cuenta registra un saldo pendiente. ¿Le gustaría regularizarlo?" },
      { human: "El viernes recibo mi pago y podría cubrirlo." },
      { ai: "Perfecto, registro su compromiso para el viernes y le envío el enlace por SMS." }
    ],
    durationSeconds: 134
  },
  {
    outcome: "NO_ANSWER",
    ai: {
      aiSummary:
        "No hubo respuesta del cliente; la llamada entró a buzón. Se recomienda reintentar.",
      aiSentiment: "NEUTRAL",
      aiResult: "Sin contacto",
      aiNextStep: "Reintentar mañana en horario laboral"
    },
    transcript: [{ ai: "Buenas tardes, le llamamos de QCobro. Por favor devuelva la llamada." }],
    durationSeconds: 18
  },
  {
    outcome: "PAID",
    ai: {
      aiSummary: "El cliente confirma que ya realizó el pago en línea esta mañana. Caso resuelto.",
      aiSentiment: "POSITIVE",
      aiDebtReason: "Olvido de fecha de pago",
      aiResult: "Pago confirmado",
      aiNextStep: "Cerrar gestión y verificar conciliación"
    },
    transcript: [
      { ai: "Buenas tardes, le contacto por su saldo pendiente." },
      { human: "Ya lo pagué esta mañana por la página." },
      { ai: "Excelente, muchas gracias. Doy por resuelta la gestión." }
    ],
    durationSeconds: 47
  }
];

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400_000).toISOString();
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const accountId = process.argv[2];
  const account = accountId
    ? await prisma.portfolioAccount.findUnique({
        where: { id: accountId },
        include: { portfolio: true }
      })
    : await prisma.portfolioAccount.findFirst({
        where: { archivedAt: null },
        include: { portfolio: true }
      });

  if (!account) {
    console.error(
      "No portfolio account found. Create a cartera and import accounts first, or pass an account id."
    );
    process.exit(1);
  }

  console.log(
    `Seeding ${SCENARIOS.length} Voz IA gestiones for "${account.fullName}" (${account.externalId})`
  );
  console.log(
    `Workspace: ${account.portfolio.workspaceRef} · Cartera: ${account.portfolio.name}\n`
  );

  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    const callRef = `seed-voz-${Date.now()}-${i}`;
    const phone = account.phone ?? "+520000000000";

    // 1) Dispatch-style record (what the outreach layer writes at call placement).
    await postJson("/api/contact-logs", {
      portfolioAccountId: account.id,
      agentType: "VOICE_AI",
      contactedAt: new Date().toISOString(),
      outcome: s.outcome,
      notes: "Seed Voz IA",
      debtAmountSnapshot: account.outstandingBalance,
      ...(s.intentMetadata ? { intentMetadata: s.intentMetadata } : {}),
      ...s.ai,
      channelData: { providerRef: callRef, from: "+15550000000", to: phone }
    });

    // 2) Autopilot conversation.ended webhook — attaches transcript + recording.
    const result = await postJson("/api/voice/events", {
      eventType: "conversation.ended",
      appRef: "seed-app",
      callRef,
      phone,
      chatHistory: s.transcript,
      recordingUrl: SAMPLE_RECORDING,
      durationSeconds: s.durationSeconds
    });

    console.log(
      `  [${i + 1}] ${s.outcome} · webhook matched=${result.matched} (callRef ${callRef})`
    );
  }

  console.log("\nDone. Open Gestiones, filter to Voz IA, and click a row to see the card.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
