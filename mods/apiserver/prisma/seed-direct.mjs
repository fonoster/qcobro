import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const db = new Database("./prisma/qcobro.db");
db.pragma("foreign_keys = OFF");
db.pragma("journal_mode = WAL");

// ── Clear ─────────────────────────────────────────────────────────────────────
db.transaction(() => {
  for (const t of ["commitments","activities","accounts","campaigns","agents","portfolios","users"])
    db.prepare(`DELETE FROM ${t}`).run();
})();
console.log("✓ Tablas limpiadas");

const now = new Date().toISOString();
function daysAgo(n)  { const d = new Date(); d.setDate(d.getDate() - n);   return d.toISOString(); }
function daysAhead(n){ const d = new Date(); d.setDate(d.getDate() + n);   return d.toISOString(); }
function hoursAgo(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString(); }

// ── Admin ─────────────────────────────────────────────────────────────────────
const hash = await bcrypt.hash("admin1234", 10);
db.prepare("INSERT INTO users (id,email,name,role,passwordHash,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)")
  .run(randomUUID(), "admin@qcobro.com", "Administrador", "ADMIN", hash, now, now);

// ── Agentes IA ────────────────────────────────────────────────────────────────
const agents = [
  { id: randomUUID(), name: "María",   email: "maria@qcobro.com",   channel: "VOICE_AI",  strategy: "MODERATE",   status: "ACTIVE", calls: 412, promises: 98,  recovered: 3_140_000, successRate: 74 },
  { id: randomUUID(), name: "Juan",    email: "juan@qcobro.com",    channel: "WHATSAPP",  strategy: "AGGRESSIVE", status: "ACTIVE", calls: 634, promises: 143, recovered: 4_870_000, successRate: 68 },
  { id: randomUUID(), name: "Manuel",  email: "manuel@qcobro.com",  channel: "SMS",       strategy: "GENTLE",     status: "ACTIVE", calls: 289, promises: 81,  recovered: 2_210_000, successRate: 81 },
  { id: randomUUID(), name: "Carmen",  email: "carmen@qcobro.com",  channel: "EMAIL",     strategy: "MODERATE",   status: "ACTIVE", calls: 198, promises: 54,  recovered: 1_650_000, successRate: 77 },
];
const insAgent = db.prepare("INSERT INTO agents (id,name,email,channel,strategy,status,calls,promises,recovered,successRate,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
for (const a of agents) insAgent.run(a.id,a.name,a.email,a.channel,a.strategy,a.status,a.calls,a.promises,a.recovered,a.successRate,now,now);

// ── Carteras ──────────────────────────────────────────────────────────────────
const portfolios = [
  { id: randomUUID(), name: "Clientes Activos",  clientId: "mikro-activos",   accounts: 420, totalAmount: 18_500_000, recoveredAmount: 6_340_000, status: "ACTIVE" },
  { id: randomUUID(), name: "Prospectos",         clientId: "mikro-prospectos", accounts: 215, totalAmount:  9_200_000, recoveredAmount: 3_750_000, status: "ACTIVE" },
  { id: randomUUID(), name: "Morosos",            clientId: "mikro-morosos",   accounts: 148, totalAmount:  6_800_000, recoveredAmount: 2_910_000, status: "ACTIVE" },
];
const insPortfolio = db.prepare("INSERT INTO portfolios (id,name,clientId,accounts,totalAmount,recoveredAmount,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)");
for (const p of portfolios) insPortfolio.run(p.id,p.name,p.clientId,p.accounts,p.totalAmount,p.recoveredAmount,p.status,now,now);
const [p1, p2, p3] = portfolios;

// ── Campañas ──────────────────────────────────────────────────────────────────
const campaigns = [
  { id: randomUUID(), name: "Recordatorio Cuotas",  portfolioId: p1.id, agentId: agents[0].id, channel: "VOICE_AI", status: "IN_PROGRESS", accounts: 180, startDate: daysAgo(45), endDate: daysAhead(45) },
  { id: randomUUID(), name: "Bienvenida Prospectos", portfolioId: p2.id, agentId: agents[1].id, channel: "WHATSAPP", status: "IN_PROGRESS", accounts: 100, startDate: daysAgo(20), endDate: daysAhead(10) },
  { id: randomUUID(), name: "Renegociación Mora",   portfolioId: p3.id, agentId: agents[2].id, channel: "SMS",      status: "IN_PROGRESS", accounts: 50,  startDate: daysAgo(10), endDate: null },
  { id: randomUUID(), name: "Retención Clientes",   portfolioId: p1.id, agentId: agents[3].id, channel: "EMAIL",    status: "SCHEDULED",   accounts: 90,  startDate: daysAhead(7), endDate: null },
  { id: randomUUID(), name: "Recuperación Q1",      portfolioId: p3.id, agentId: null,         channel: "VOICE_AI", status: "COMPLETED",   accounts: 148, startDate: daysAgo(90), endDate: daysAgo(30) },
];
const insCampaign = db.prepare("INSERT INTO campaigns (id,name,portfolioId,agentId,channel,status,accounts,startDate,endDate,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
for (const c of campaigns) insCampaign.run(c.id,c.name,c.portfolioId,c.agentId,c.channel,c.status,c.accounts,c.startDate,c.endDate,now,now);
const [c1, c2, c3] = campaigns;

// ── Cuentas ───────────────────────────────────────────────────────────────────
const debtors = [
  { id: "ACC-001", fullName: "Carlos Martínez Peña",   phone: "809-555-0101", balance: 85_000,  dpd: 45 },
  { id: "ACC-002", fullName: "María García Rodríguez", phone: "809-555-0102", balance: 142_000, dpd: 30 },
  { id: "ACC-003", fullName: "José Almánzar Cruz",     phone: "829-555-0103", balance: 67_000,  dpd: 62 },
  { id: "ACC-004", fullName: "Ana Disla Feliz",        phone: "849-555-0104", balance: 210_000, dpd: 15 },
  { id: "ACC-005", fullName: "Pedro Taveras Núñez",    phone: "809-555-0105", balance: 95_000,  dpd: 88 },
  { id: "ACC-006", fullName: "Carmen Familia Pérez",   phone: "829-555-0106", balance: 58_000,  dpd: 21 }
];
const insAccount = db.prepare("INSERT INTO accounts (id,externalId,portfolioId,fullName,phone,email,preferredLanguage,outstandingBalance,daysPastDue,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
for (const d of debtors) insAccount.run(randomUUID(),d.id,p1.id,d.fullName,d.phone,`${d.id.toLowerCase().replace("-","")}@correo.do`,"es",d.balance,d.dpd,"ACTIVE",now,now);

// ── Channel data builders ─────────────────────────────────────────────────────
function voiceData(_debtor) {
  return JSON.stringify({
    recordingUrl: "https://qcobro.com/assets/cobro_demo.wav",
    transcript: [
      { role: "debtor", text: "Aló." },
      { role: "ai",     text: "¿Hablo con José?" },
      { role: "debtor", text: "Sí, él habla." },
      { role: "ai",     text: "Mire, usted tiene dos pagos atrasados de seis cincuenta pesos. ¿Le gustaría ver opciones para ajustar su cuota?" },
      { role: "debtor", text: "¿Pero de dónde me llaman?" },
      { role: "ai",     text: "De Mikro Créditos. ¿Le gustaría ver opciones para ajustar su cuota?" },
      { role: "debtor", text: "Sí, por favor." },
      { role: "ai",     text: "Mire, una opción sería pagar seiscientos pesos semanal con once cuotas. ¿Qué le parece eso?" },
      { role: "debtor", text: "Pero sería demasiado." },
      { role: "ai",     text: "También hay otra: quinientos cincuenta pesos semanal con trece cuotas. ¿Esa le funciona mejor?" },
      { role: "debtor", text: "Sí, podrían hacer eso." },
      { role: "ai",     text: "Perfecto, lo dejo anotado. Un supervisor lo va a revisar y le avisarán la decisión." },
      { role: "debtor", text: "Pues está bien, entonces. Gracias." },
      { role: "ai",     text: "Que tenga buen día." },
      { role: "debtor", text: "Ok, gracias." },
    ]
  });
}

function smsData(debtor) {
  return JSON.stringify({
    messages: [
      { role: "qcobro", text: `Hola ${debtor.fullName.split(" ")[0]}, le contactamos de Mikro Créditos. Tiene un saldo pendiente de RD$${debtor.balance.toLocaleString()}. Responda SI para conocer sus opciones.` },
      { role: "debtor", text: "SI" },
      { role: "qcobro", text: `Gracias. Su saldo está vencido hace ${debtor.dpd} días. ¿Desea recibir un plan de pago? Responda PLAN para continuar.` },
      { role: "debtor", text: "PLAN" },
      { role: "qcobro", text: "Le enviaremos las opciones disponibles por correo electrónico en los próximos minutos. ¿Su correo es correcto en nuestros registros?" },
      { role: "debtor", text: "Sí, está correcto" },
      { role: "qcobro", text: "Excelente. Un asesor le contactará mañana para confirmar su plan. ¡Que tenga buen día!" },
    ]
  });
}

function whatsappData(debtor) {
  return JSON.stringify({
    messages: [
      { role: "qcobro", text: `Hola ${debtor.fullName.split(" ")[0]} 👋 Le escribe el equipo de Mikro Créditos. Tiene un saldo pendiente de *RD$${debtor.balance.toLocaleString()}*. ¿Podemos ayudarle a regularizarlo?` },
      { role: "debtor", text: "Hola, sí, estaba pensando en llamarles." },
      { role: "qcobro", text: `Entendemos. Su cuenta lleva ${debtor.dpd} días en mora. Tenemos opciones flexibles disponibles. ¿Le gustaría ver un plan de cuotas?` },
      { role: "debtor", text: "Sí, me interesa. ¿Cuánto sería la cuota mensual?" },
      { role: "qcobro", text: "Podemos dividirlo en 3 cuotas de RD$" + Math.round(debtor.balance / 3).toLocaleString() + " mensuales sin intereses adicionales. ¿Le parece bien?" },
      { role: "debtor", text: "Está bien. ¿Cómo hago el primer pago?" },
      { role: "qcobro", text: "Puede pagar vía transferencia bancaria o en cualquier agente autorizado. Le envío los detalles ahora. ✅" },
    ]
  });
}

function emailData(debtor) {
  return JSON.stringify({
    from: "cobranza@qcobro.com",
    to: `${debtor.id.toLowerCase().replace("-","")}@correo.do`,
    subject: `Recordatorio de pago — Cuenta ${debtor.id}`,
    body: `Estimado/a ${debtor.fullName},\n\nEsperamos que se encuentre bien. Le contactamos para recordarle que su cuenta presenta un saldo pendiente de RD$${debtor.balance.toLocaleString()}, con ${debtor.dpd} días de mora.\n\nEntendemos que pueden surgir situaciones inesperadas. Por eso, estamos disponibles para trabajar juntos en una solución que se adapte a sus posibilidades.\n\nPuede comunicarse con nosotros respondiendo este correo o llamando al 809-555-0100 en horario de 8am a 6pm.\n\nAtentamente,\nEquipo de Cobranza — Mikro Créditos`,
    deliveryStatus: "DELIVERED",
    openCount: Math.floor(Math.random() * 3) + 1,
  });
}

// ── AI insight builders (channel-aware, matching actual transcripts) ──────────
function channelInsights(channel, debtor) {
  switch (channel) {
    case "VOICE_AI":
    case "VOICE":
      return {
        outcome: "PROMISE",
        aiSummary: "El deudor confirmó su identidad y reconoció la deuda de dos pagos atrasados de RD$650. Inicialmente mostró desconfianza sobre el origen de la llamada, pero tras aclarar que se trata de Mikro Créditos, accedió a revisar opciones. Se le presentaron dos alternativas: RD$600/semanal en 11 cuotas y RD$550/semanal en 13 cuotas. Aceptó la segunda opción. El acuerdo queda pendiente de revisión por un supervisor.",
        aiSentiment: "Receptivo",
        aiDebtReason: null,
        aiResult: "Acuerdo de renegociación",
        aiNextStep: "Supervisar aprobación del plan de RD$550/semanal x 13 cuotas y notificar al deudor la decisión.",
      };
    case "SMS":
      return {
        outcome: "CONTACTED",
        aiSummary: `Se contactó a ${debtor.fullName} por SMS y respondió afirmativamente. Mostró interés en recibir un plan de pago y confirmó que su correo electrónico en registros es correcto. Se le indicó que recibiría opciones por correo y que un asesor le contactará al día siguiente.`,
        aiSentiment: "Cooperativo",
        aiDebtReason: null,
        aiResult: "Contacto efectivo",
        aiNextStep: "Enviar opciones de plan de pago por correo electrónico y programar llamada de seguimiento para el día siguiente.",
      };
    case "WHATSAPP":
      return {
        outcome: "PROMISE",
        aiSummary: `${debtor.fullName} respondió positivamente al contacto por WhatsApp e indicó que ya tenía intención de comunicarse. Aceptó un plan de 3 cuotas mensuales de RD$${Math.round(debtor.balance / 3).toLocaleString()} sin intereses adicionales y solicitó instrucciones para realizar el primer pago. Se le enviaron los detalles de transferencia bancaria y agentes autorizados.`,
        aiSentiment: "Cooperativo",
        aiDebtReason: null,
        aiResult: "Plan de cuotas acordado",
        aiNextStep: "Confirmar recepción del primer pago y enviar recordatorio 3 días antes de la segunda cuota.",
      };
    case "EMAIL":
      return {
        outcome: "CONTACTED",
        aiSummary: `Se envió correo electrónico de recordatorio de pago a ${debtor.fullName}. El correo fue entregado exitosamente y registró aperturas, lo que indica que el deudor lo leyó. No se ha recibido respuesta aún.`,
        aiSentiment: "Neutral",
        aiDebtReason: null,
        aiResult: "Notificación entregada",
        aiNextStep: "Esperar respuesta por 48 horas. Si no hay respuesta, escalar a contacto por canal directo (WhatsApp o llamada).",
      };
  }
}

// ── Gestiones ─────────────────────────────────────────────────────────────────
const cTypeList = ["PAYMENT_PROMISE","RENEGOTIATION","MESSAGE_DELIVERY"];
const cNoteMap  = {
  PAYMENT_PROMISE:  "Cliente acordó realizar el pago completo en la fecha indicada.",
  RENEGOTIATION:    "Nueva tabla de amortización acordada. Intereses congelados por 60 días.",
  MESSAGE_DELIVERY: "Notificación formal enviada y confirmada como recibida.",
};

const insAct = db.prepare(`INSERT INTO activities
  (id,campaignId,accountId,agentId,channel,outcome,notes,debtAmount,durationSeconds,
   aiSummary,aiSentiment,aiDebtReason,aiResult,aiNextStep,channelData,createdAt,updatedAt)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insCom = db.prepare("INSERT INTO commitments (id,activityId,accountId,type,amount,dueDate,status,notes,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)");

let actCount = 0, comCount = 0;

function insertBatch(campaign, agentIdx, count, hourBase) {
  const agent = agents[agentIdx % agents.length];
  const channel = agent.channel;

  for (let i = 0; i < count; i++) {
    const debtor   = debtors[i % debtors.length];
    const actId    = randomUUID();
    const createdAt = hoursAgo(hourBase + i);
    const ai = channelInsights(channel, debtor);
    const outcome = ai.outcome;

    let channelData = null;
    let durationSeconds = null;
    if (channel === "VOICE_AI" || channel === "VOICE") {
      channelData = voiceData(debtor);
      durationSeconds = 90 + Math.floor(Math.random() * 180);
    } else if (channel === "SMS") {
      channelData = smsData(debtor);
    } else if (channel === "WHATSAPP") {
      channelData = whatsappData(debtor);
    } else if (channel === "EMAIL") {
      channelData = emailData(debtor);
    }

    insAct.run(
      actId, campaign.id, debtor.id, agent.id, channel, outcome, ai.aiSummary,
      debtor.balance, durationSeconds,
      ai.aiSummary, ai.aiSentiment, ai.aiDebtReason, ai.aiResult, ai.aiNextStep,
      channelData, createdAt, createdAt
    );
    actCount++;

    if (outcome === "PROMISE") {
      const cType  = cTypeList[i % cTypeList.length];
      const amount = cType === "MESSAGE_DELIVERY" ? 0 : 15_000 + i * 7_500;
      const status = i % 3 === 2 ? "FULFILLED" : i % 3 === 0 ? "PENDING" : "OVERDUE";
      insCom.run(randomUUID(), actId, debtor.id, cType, amount, daysAhead(7 + i % 14), status, cNoteMap[cType], createdAt, createdAt);
      comCount++;
    }
  }
}

insertBatch(c1, 0, 3, 1);
insertBatch(c3, 2, 2, 4);

console.log(`✓ Seed completo: ${agents.length} agentes, ${portfolios.length} carteras, ${campaigns.length} campañas, ${debtors.length} cuentas, ${actCount} gestiones, ${comCount} compromisos`);

db.close();
console.log("✅ Acceso: admin@qcobro.com / admin1234");
