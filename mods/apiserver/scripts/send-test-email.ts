/**
 * TEMPORARY end-to-end email test.
 *
 * Sends a real email (via Resend) to a portfolio account and creates the matching
 * EMAIL gestión in the DB, with the reply-to token = gestión providerRef. When the
 * recipient replies, Resend's inbound webhook correlates the reply to this gestión,
 * hydrates the body from the Received Emails API, runs the autopilot, and updates the
 * thread — so you can open the gestión detail and verify the customer's reply is there.
 *
 * Usage:
 *   npm run email:send-test --workspace=mods/apiserver
 *   npm run email:send-test --workspace=mods/apiserver -- --to=sanderspedro@gmail.com
 *
 * After replying, find the gestión with:
 *   npm run email:check --workspace=mods/apiserver -- --id=<gestiónId>
 */

import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { config } from "../src/config.js";
import { ResendEmailClient } from "../src/services/resendEmailClient.js";
import { createRecordOutcome } from "../src/functions/campaigns/recordOutcome.js";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.slice(2).split("=");
      return [k, rest.join("=")];
    })
);

const toEmail = args.to ?? "sanderspedro@gmail.com";

const resend = config.resend;
if (!resend) {
  console.error("❌  No 'resend' block in qcobro.json — add it and restart.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: config.database.url } } });

// ── Find the recipient account + an EMAIL campaign in its workspace ─────────────
const account = await prisma.portfolioAccount.findFirst({
  where: { email: toEmail },
  include: { portfolio: true },
  orderBy: { createdAt: "desc" }
});

if (!account) {
  console.error(`❌  No portfolio account found with email ${toEmail}.`);
  console.error("    Import a portfolio that includes this email first.");
  await prisma.$disconnect();
  process.exit(1);
}

const workspaceRef = account.portfolio.workspaceRef;
const campaign = await prisma.campaign.findFirst({
  where: { workspaceRef, agentTemplate: { type: "EMAIL" } },
  include: { agentTemplate: { include: { emailConfig: true } } },
  orderBy: { createdAt: "desc" }
});

if (!campaign) {
  console.error(`❌  No EMAIL campaign found in workspace ${workspaceRef}.`);
  console.error("    Create an EMAIL agent + campaign in the console first.");
  await prisma.$disconnect();
  process.exit(1);
}

// ── Send a real email with a correlation token in the reply-to ──────────────────
const token = randomUUID();
const replyTo = `reply+${token}@${resend.inboundDomain}`;
const subject = "Recordatorio de pago — prueba de respuesta";
const messageBody = [
  `Estimado ${account.fullName},`,
  "",
  "Este es un correo de prueba de QCobro para verificar la captura de respuestas.",
  "Por favor responda a este correo con cualquier mensaje (por ejemplo, una fecha de pago)",
  "para confirmar que su respuesta queda registrada en el detalle de la gestión.",
  "",
  "Atentamente, Equipo de Cobranza · QCobro"
].join("\n");

const emailClient = new ResendEmailClient(resend);

console.log(`\n── Sending test email ──`);
console.log(`    To:       ${toEmail} (${account.fullName} · ${account.externalId})`);
console.log(`    Campaign: ${campaign.name}`);
console.log(`    Reply-To: ${replyTo}`);

try {
  const { id } = await emailClient.sendEmail({
    from: resend.fromEmail,
    fromName: resend.fromName,
    to: toEmail,
    subject,
    body: messageBody,
    replyTo
  });
  console.log(`✅  Sent — Resend message id: ${id}`);
} catch (err) {
  console.error("❌  Send failed:", (err as Error).message ?? err);
  await prisma.$disconnect();
  process.exit(1);
}

// ── Create the matching gestión (providerRef = token) so the reply correlates ───
const at = new Date().toISOString();
const log = await createRecordOutcome(prisma as never)({
  portfolioAccountId: account.id,
  campaignId: campaign.id,
  agentType: "EMAIL",
  contactedAt: at,
  outcome: "OTHER",
  notes: "Correo de prueba (script)",
  debtAmountSnapshot: account.outstandingBalance,
  providerRef: token,
  channelData: {
    from: resend.fromEmail,
    to: toEmail,
    subject,
    messageBody
  }
});

await prisma.$disconnect();

console.log(`\n✅  Gestión created: ${(log as { id: string }).id}`);
console.log(`    providerRef (token): ${token}`);
console.log(`\n── Next steps ──`);
console.log(`  1. Reply to the email in your inbox (${toEmail}).`);
console.log(
  `  2. Make sure the apiserver is reachable from Resend (ngrok tunnel + inbound route).`
);
console.log(`  3. Verify the captured reply:`);
console.log(
  `       npm run email:check --workspace=mods/apiserver -- --id=${(log as { id: string }).id}`
);
