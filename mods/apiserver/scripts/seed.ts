/**
 * Demo seed: provisions a complete "Mikro Créditos" workspace for live demos.
 *
 * Creates (idempotently — safe to re-run):
 *   - user        Demo User <demo@qcobro.com>
 *   - workspace   "Mikro Créditos"
 *   - portfolio   "Prueba de concepto"  (+ the inlined demo accounts below)
 *   - agents      Juan (Voz IA), Recordatorio SMS (SMS), Sofia (Voz pregrabada)
 *   - campaigns   Cobro Compulsivo, Recuperación Q2 2026, Pre-mora Q2 2026
 *
 * User + workspace go through the Fonoster Identity gRPC service (the same path the
 * app uses); everything else is written via the apiserver's own function factories
 * so the seed exercises the real create logic (incl. Fonoster Autopilot provisioning
 * for the Voz IA agent, best-effort).
 *
 * Run from the apiserver package so config + Prisma resolve as in `start:dev`:
 *   npm run db:seed --workspace=mods/apiserver
 *
 * Overridable inputs (env): SEED_AUTOPILOT_YAML, SEED_DEMO_PHONE.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { createIdentityClient } from "@fonoster/identity-client";
import type { AccountRowInput } from "@qcobro/common";
import { prisma } from "../src/db.js";
import { config } from "../src/config.js";
import { FonosterVoiceApplicationClient } from "../src/services/fonosterVoiceApplicationClient.js";
import { createCreatePortfolio } from "../src/functions/portfolios/createPortfolio.js";
import { createSyncAccounts } from "../src/functions/portfolios/syncAccounts.js";
import { createCreateAgentTemplate } from "../src/functions/agentTemplates/createAgentTemplate.js";
import { createCreateCampaign } from "../src/functions/campaigns/createCampaign.js";
import { createCreateContactLog } from "../src/functions/campaigns/createContactLog.js";
import { createIngestVoiceEvent } from "../src/functions/voice/ingestVoiceEvent.js";

// --- Inputs -----------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
// Voz IA autopilot config (system prompt + voice + language), kept as a repo asset.
const YAML_PATH = process.env.SEED_AUTOPILOT_YAML ?? resolve(HERE, "assets/autopilot.yaml");
// Every account's phone is forced to this number so demo calls/SMS always reach the operator.
const DEMO_PHONE = process.env.SEED_DEMO_PHONE ?? "+17853178070";

const USER = { name: "Demo User", email: "demo@qcobro.com", password: "password123" };
const WORKSPACE_NAME = "Mikro Créditos";
const PORTFOLIO = { name: "Prueba de concepto", clientId: "MIKRO", currency: "DOP" as const };
const JUAN_FIRST_MESSAGE = "";

/**
 * Demo portfolio accounts (the example Mikro Créditos client list, inlined). `phone`
 * is omitted on purpose — it's set to DEMO_PHONE for every account in `main`, so all
 * demo calls/SMS reach the operator regardless of the real numbers.
 */
const ACCOUNTS: Omit<AccountRowInput, "phone">[] = [
  {
    externalId: "LN001023",
    fullName: "Pedro Sanders",
    preferredLanguage: "es-DO",
    bestTimeToCall: "PM",
    customerSegment: "control",
    principalAmount: 15000,
    termsAmount: 750,
    termsFrequency: "weekly",
    termsLength: 24,
    outstandingBalance: 9500,
    daysPastDue: 30,
    missedInstallments: 4,
    lastPaymentDate: "2026-04-03",
    lastPaymentAmount: 750,
    negotiationOptions:
      '[{"terms_amount":600,"terms_frequency":"weekly","terms_length":11},{"terms_amount":550,"terms_frequency":"weekly","terms_length":13}]'
  },
  {
    externalId: "LN001024",
    fullName: "María Altagracia Fernández",
    preferredLanguage: "es-DO",
    bestTimeToCall: "AM",
    customerSegment: "variant_A",
    principalAmount: 20000,
    termsAmount: 800,
    termsFrequency: "weekly",
    termsLength: 30,
    outstandingBalance: 13200,
    daysPastDue: 30,
    missedInstallments: 4,
    lastPaymentDate: "2026-04-05",
    lastPaymentAmount: 800
  },
  {
    externalId: "LN001025",
    fullName: "Pedro Antonio Jiménez",
    preferredLanguage: "es-DO",
    bestTimeToCall: "PM",
    customerSegment: "variant_A",
    principalAmount: 10000,
    termsAmount: 600,
    termsFrequency: "weekly",
    termsLength: 20,
    outstandingBalance: 5500,
    daysPastDue: 30,
    missedInstallments: 4,
    lastPaymentDate: "2026-04-04",
    lastPaymentAmount: 600
  },
  {
    externalId: "LN001026",
    fullName: "Rosa Elena Martínez",
    preferredLanguage: "es-DO",
    bestTimeToCall: "18:00-20:00",
    customerSegment: "control",
    principalAmount: 25000,
    termsAmount: 800,
    termsFrequency: "weekly",
    termsLength: 36,
    outstandingBalance: 17500,
    daysPastDue: 30,
    missedInstallments: 4,
    lastPaymentDate: "2026-04-06",
    lastPaymentAmount: 800
  },
  {
    externalId: "LN001027",
    fullName: "Luis Miguel Santana",
    preferredLanguage: "es-DO",
    bestTimeToCall: "PM",
    customerSegment: "variant_B",
    principalAmount: 12000,
    termsAmount: 600,
    termsFrequency: "weekly",
    termsLength: 24,
    outstandingBalance: 7800,
    daysPastDue: 30,
    missedInstallments: 4,
    lastPaymentDate: "2026-04-02",
    lastPaymentAmount: 600
  },
  {
    externalId: "LN001028",
    fullName: "Carmen Yolanda Reyes",
    preferredLanguage: "es-DO",
    bestTimeToCall: "AM",
    customerSegment: "control",
    principalAmount: 18000,
    termsAmount: 900,
    termsFrequency: "weekly",
    termsLength: 24,
    outstandingBalance: 11700,
    daysPastDue: 30,
    missedInstallments: 4,
    lastPaymentDate: "2026-04-07",
    lastPaymentAmount: 900
  },
  {
    externalId: "LN001029",
    fullName: "José Manuel Tavárez",
    preferredLanguage: "es-DO",
    bestTimeToCall: "PM",
    customerSegment: "variant_A",
    principalAmount: 30000,
    termsAmount: 900,
    termsFrequency: "weekly",
    termsLength: 40,
    outstandingBalance: 22500,
    daysPastDue: 30,
    missedInstallments: 4,
    lastPaymentDate: "2026-04-04",
    lastPaymentAmount: 900
  },
  {
    externalId: "LN001030",
    fullName: "Ana Lucía Espinal",
    preferredLanguage: "es-DO",
    bestTimeToCall: "AM",
    customerSegment: "variant_B",
    principalAmount: 8000,
    termsAmount: 600,
    termsFrequency: "weekly",
    termsLength: 16,
    outstandingBalance: 4200,
    daysPastDue: 30,
    missedInstallments: 4,
    lastPaymentDate: "2026-04-03",
    lastPaymentAmount: 600
  },
  {
    externalId: "LN001031",
    fullName: "Francisco Javier Núñez",
    preferredLanguage: "es-DO",
    bestTimeToCall: "18:00-20:00",
    customerSegment: "control",
    principalAmount: 22000,
    termsAmount: 850,
    termsFrequency: "weekly",
    termsLength: 30,
    outstandingBalance: 15400,
    daysPastDue: 30,
    missedInstallments: 4,
    lastPaymentDate: "2026-04-05",
    lastPaymentAmount: 850
  },
  {
    externalId: "LN001032",
    fullName: "Mercedes del Carmen Polanco",
    preferredLanguage: "es-DO",
    bestTimeToCall: "PM",
    customerSegment: "variant_A",
    principalAmount: 14000,
    termsAmount: 700,
    termsFrequency: "weekly",
    termsLength: 24,
    outstandingBalance: 8400,
    daysPastDue: 30,
    missedInstallments: 4,
    lastPaymentDate: "2026-04-06",
    lastPaymentAmount: 700
  }
];

// "Sofía" voice from qcobro.json's Fonoster voice pool (ElevenLabs, es, female).
const SOFIA_VOICE = "86V9x9hrQds83qf7zaGn";

const SMS_BODY =
  "Hola {{firstName}}, tiene un saldo pendiente de {{outstandingBalance}} {{currency}} con Mikro Créditos. Llámenos al 829-354-7577 para ponerse al día.";

const SOFIA_SCRIPT =
  "Este es un mensaje para {{firstName}}. Su cuenta con Mikro Créditos tiene un saldo pendiente de {{outstandingBalance}} pesos. Por favor, pase por nuestras oficinas cuanto antes para regularizar su pago. Gracias.";

// --- Helpers ----------------------------------------------------------------

const log = (msg: string) => console.log(`  ${msg}`);

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/** Minimal demo account shape the gestiones seeding needs. */
type SeedAccount = {
  id: string;
  fullName: string;
  phone: string | null;
  outstandingBalance: number;
};

/** Render the {{firstName}}/{{outstandingBalance}}/{{currency}} placeholders for the demo. */
function renderTemplate(tpl: string, acc: SeedAccount): string {
  return tpl
    .replace(/{{\s*firstName\s*}}/g, acc.fullName.split(" ")[0])
    .replace(/{{\s*outstandingBalance\s*}}/g, acc.outstandingBalance.toLocaleString("es-DO"))
    .replace(/{{\s*currency\s*}}/g, "DOP");
}

/** Voz IA conversation scenarios (mirrors scripts/seed-voz-gestiones.ts). */
const VOZ_SCENARIOS = [
  {
    hoursAgo: 2,
    outcome: "PAYMENT_PROMISE" as const,
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
      { ai: "Buenas tardes, le llamo de Mikro Créditos respecto a su cuenta. ¿Tiene un momento?" },
      { human: "Sí, dígame." },
      { ai: "Su cuenta registra un saldo pendiente. ¿Le gustaría regularizarlo?" },
      { human: "El viernes recibo mi pago y podría cubrirlo." },
      { ai: "Perfecto, registro su compromiso para el viernes y le envío el enlace por SMS." }
    ],
    durationSeconds: 134
  },
  {
    hoursAgo: 26,
    outcome: "NO_ANSWER" as const,
    ai: {
      aiSummary:
        "No hubo respuesta del cliente; la llamada entró a buzón. Se recomienda reintentar.",
      aiSentiment: "NEUTRAL",
      aiResult: "Sin contacto",
      aiNextStep: "Reintentar mañana en horario laboral"
    },
    transcript: [
      { ai: "Buenas tardes, le llamamos de Mikro Créditos. Por favor devuelva la llamada." }
    ],
    durationSeconds: 18
  },
  {
    hoursAgo: 72,
    outcome: "PAID" as const,
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

// A short, publicly hosted sample so the detalle audio player actually plays.
const SAMPLE_RECORDING = "https://download.samplelib.com/mp3/sample-6s.mp3";

/**
 * Seed a few gestiones across all three channels. Voz IA is written in two steps —
 * the dispatch record, then the autopilot conversation.ended event correlated by
 * call ref (transcript + recording) — exactly as the live webhook does, but in-process.
 * SMS / Voz pregrabada are one-way: just the dispatch record with the sent content.
 */
async function seedGestiones(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  accounts: SeedAccount[],
  campaigns: { voiceAi: string; sms: string; prerecorded: string }
) {
  const contactLog = createCreateContactLog(db);
  const ingestVoiceEvent = createIngestVoiceEvent(db);

  // Voz IA — three scenarios on the first account.
  const vozAccount = accounts[0];
  for (let i = 0; i < VOZ_SCENARIOS.length; i++) {
    const s = VOZ_SCENARIOS[i];
    const callRef = `seed-voz-${Date.now()}-${i}`;
    const to = vozAccount.phone ?? DEMO_PHONE;
    await contactLog({
      portfolioAccountId: vozAccount.id,
      campaignId: campaigns.voiceAi,
      agentType: "VOICE_AI",
      contactedAt: hoursAgo(s.hoursAgo),
      outcome: s.outcome,
      notes: "Seed Voz IA",
      debtAmountSnapshot: vozAccount.outstandingBalance,
      ...(s.intentMetadata ? { intentMetadata: s.intentMetadata } : {}),
      ...s.ai,
      channelData: { providerRef: callRef, from: "+18297340812", to }
    });
    await ingestVoiceEvent({
      eventType: "conversation.ended",
      appRef: "seed-app",
      callRef,
      phone: to,
      chatHistory: s.transcript,
      recordingUrl: SAMPLE_RECORDING,
      durationSeconds: s.durationSeconds
    });
    log(`Voz IA · ${s.outcome} (${vozAccount.fullName})`);
  }

  // SMS — one-way reminder on the second account.
  const smsAccount = accounts[1] ?? accounts[0];
  await contactLog({
    portfolioAccountId: smsAccount.id,
    campaignId: campaigns.sms,
    agentType: "SMS",
    contactedAt: hoursAgo(5),
    outcome: "OTHER",
    notes: "Seed SMS",
    debtAmountSnapshot: smsAccount.outstandingBalance,
    aiSummary:
      "Recordatorio de pago enviado por SMS. Canal de una vía; sin respuesta del cliente capturada.",
    channelData: {
      messageBody: renderTemplate(SMS_BODY, smsAccount),
      from: "+19842051452",
      to: smsAccount.phone ?? DEMO_PHONE
    }
  });
  log(`SMS · OTHER (${smsAccount.fullName})`);

  // Voz pregrabada — one-way played message on the third account.
  const preAccount = accounts[2] ?? accounts[0];
  await contactLog({
    portfolioAccountId: preAccount.id,
    campaignId: campaigns.prerecorded,
    agentType: "VOICE_PRERECORDED",
    contactedAt: hoursAgo(48),
    durationSeconds: 22,
    outcome: "NO_ANSWER",
    notes: "Seed Voz pregrabada",
    debtAmountSnapshot: preAccount.outstandingBalance,
    aiSummary:
      "Mensaje pregrabado reproducido en el buzón del cliente. Canal de una vía; sin respuesta capturada.",
    channelData: {
      messageBody: renderTemplate(SOFIA_SCRIPT, preAccount),
      to: preAccount.phone ?? DEMO_PHONE
    }
  });
  log(`Voz pregrabada · NO_ANSWER (${preAccount.fullName})`);
}

// --- Seed -------------------------------------------------------------------

async function main() {
  const identity = createIdentityClient(config.identity.endpoint);
  const db = prisma as never; // factories accept the narrowed @qcobro/common client types

  // 1. User -----------------------------------------------------------------
  console.log("User");
  try {
    await identity.createUser(USER);
    log(`created ${USER.email}`);
  } catch (err) {
    log(`${USER.email} already exists (${(err as Error).message.split("\n")[0]}) — reusing`);
  }
  let { accessToken } = await identity.exchangeCredentials({
    username: USER.email,
    password: USER.password
  });

  // 2. Workspace ------------------------------------------------------------
  console.log("Workspace");
  const findWorkspace = async () =>
    (await identity.listWorkspaces(accessToken)).items.find((w) => w.name === WORKSPACE_NAME);
  let workspace = await findWorkspace();
  if (!workspace) {
    await identity.createWorkspace(WORKSPACE_NAME, accessToken);
    // Re-login so the new token's claims include the workspace membership.
    accessToken = (
      await identity.exchangeCredentials({ username: USER.email, password: USER.password })
    ).accessToken;
    workspace = await findWorkspace();
    log(`created "${WORKSPACE_NAME}"`);
  } else {
    log(`"${WORKSPACE_NAME}" already exists — reusing`);
  }
  if (!workspace) throw new Error("Workspace creation did not surface in listWorkspaces");
  const workspaceRef = workspace.accessKeyId;
  log(`workspaceRef ${workspaceRef}`);

  // 3. Portfolio + accounts -------------------------------------------------
  console.log("Portfolio");
  let portfolio = await prisma.portfolio.findFirst({
    where: { workspaceRef, name: PORTFOLIO.name }
  });
  if (!portfolio) {
    portfolio = await createCreatePortfolio(db, workspaceRef)(PORTFOLIO);
    log(`created "${PORTFOLIO.name}"`);
  } else {
    log(`"${PORTFOLIO.name}" already exists — reusing`);
  }
  const rows: AccountRowInput[] = ACCOUNTS.map((a) => ({ ...a, phone: DEMO_PHONE }));
  const sync = await createSyncAccounts(db)({ portfolioId: portfolio.id, mode: "REPLACE", rows });
  log(`accounts synced (all phones → ${DEMO_PHONE}): ${JSON.stringify(sync)}`);

  // 4. Agents ---------------------------------------------------------------
  console.log("Agents");
  const voiceApplications = config.fonoster
    ? new FonosterVoiceApplicationClient(config.fonoster)
    : null;
  const createAgent = createCreateAgentTemplate(db, workspaceRef, voiceApplications);

  async function ensureAgent(
    name: string,
    type: "VOICE_AI" | "VOICE_PRERECORDED" | "SMS",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: any
  ): Promise<string> {
    const existing = await prisma.agentTemplate.findFirst({ where: { workspaceRef, name, type } });
    if (existing) {
      log(`"${name}" (${type}) already exists — reusing`);
      return existing.id;
    }
    const created = await createAgent({ name, type, ...params });
    log(`created "${name}" (${type})`);
    return created.id;
  }

  const yaml = parseYaml(readFileSync(YAML_PATH, "utf8"));
  const juanId = await ensureAgent("Juan", "VOICE_AI", {
    voice: yaml.textToSpeech.config.voice,
    language: yaml.speechToText.config.languageCode,
    systemPrompt: yaml.intelligence.config.conversationSettings.systemPrompt,
    firstMessage: JUAN_FIRST_MESSAGE,
    fonosterAppName: "Juan Voz IA"
  });
  const smsId = await ensureAgent("Recordatorio SMS", "SMS", { messageBody: SMS_BODY });
  const sofiaId = await ensureAgent("Sofia", "VOICE_PRERECORDED", {
    voice: SOFIA_VOICE,
    language: "es",
    script: SOFIA_SCRIPT
  });

  // 5. Campaigns ------------------------------------------------------------
  console.log("Campaigns");
  const today = new Date();
  const createCampaign = createCreateCampaign(db, workspaceRef);
  const schedule = {
    portfolioIds: [portfolio.id],
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "18:00",
    maxAttemptsPerAccount: 5,
    maxAttemptsPerDay: 2
  };

  async function ensureCampaign(
    name: string,
    agentTemplateId: string,
    endMonths: number
  ): Promise<string> {
    const existing = await prisma.campaign.findFirst({ where: { workspaceRef, name } });
    if (existing) {
      log(`"${name}" already exists — reusing`);
      return existing.id;
    }
    const created = await createCampaign({
      name,
      agentTemplateId,
      startDate: isoDate(today),
      endDate: isoDate(addMonths(today, endMonths)),
      ...schedule
    });
    log(`created "${name}"`);
    return created.id;
  }

  const cobroId = await ensureCampaign("Cobro Compulsivo", juanId, 1);
  const recuperacionId = await ensureCampaign("Recuperación Q2 2026", smsId, 2);
  const premoraId = await ensureCampaign("Pre-mora Q2 2026", sofiaId, 2);

  // 6. Gestiones ------------------------------------------------------------
  // A handful of contact logs across all three channels so the Gestiones list +
  // detalle card have content. Voz IA mirrors scripts/seed-voz-gestiones.ts: the
  // dispatch record plus the autopilot conversation.ended event (transcript +
  // recording), but driven in-process instead of over HTTP.
  console.log("Gestiones");
  const accounts = await prisma.portfolioAccount.findMany({
    where: { portfolioId: portfolio.id, archivedAt: null },
    orderBy: { externalId: "asc" }
  });
  const existingGestiones = await prisma.accountContactLog.count({
    where: { portfolioAccount: { portfolioId: portfolio.id } }
  });
  if (existingGestiones > 0 || accounts.length === 0) {
    log(`${existingGestiones} gestiones already present — skipping`);
  } else {
    await seedGestiones(db, accounts, {
      voiceAi: cobroId,
      sms: recuperacionId,
      prerecorded: premoraId
    });
  }

  console.log("\nDone. Log in at the webapp with demo@qcobro.com / password123.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("\nSeed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
