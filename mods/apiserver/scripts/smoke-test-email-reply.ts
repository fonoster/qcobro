/**
 * Round-trip smoke test: finds a real EMAIL gestión in the DB, simulates an
 * inbound reply via the webhook, and shows the autopilot decision.
 *
 * Pre-requisite: run `engine:sim` first so EMAIL gestiones exist in the DB.
 *
 * Usage:
 *   npm run email:smoke-reply --workspace=mods/apiserver
 *   npm run email:smoke-reply --workspace=mods/apiserver -- --server=https://xxx.ngrok.app
 *   npm run email:smoke-reply --workspace=mods/apiserver -- --text="Voy a pagar el viernes"
 */

import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { config } from "../src/config.js";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.slice(2).split("=");
      return [k, rest.join("=")];
    })
);

const server = args.server ?? "http://localhost:3000";
const replyText =
  args.text ?? "Voy a pagar el viernes de la próxima semana. ¿Me pueden dar facilidades?";

const resend = config.resend;
if (!resend) {
  console.error("❌  No 'resend' block in qcobro.json");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: config.database.url } } });

console.log("\n── Finding a real EMAIL gestión in the DB ──");

const log = await prisma.accountContactLog.findFirst({
  where: {
    channel: "EMAIL",
    providerRef: { not: null }
  },
  include: {
    portfolioAccount: true,
    campaign: { include: { agentTemplate: { include: { emailConfig: true } } } }
  },
  orderBy: { createdAt: "desc" }
});

await prisma.$disconnect();

if (!log || !log.providerRef) {
  console.error("❌  No EMAIL gestiones found in the DB.");
  console.error("    Run `npm run engine:sim --workspace=mods/apiserver` first.");
  process.exit(1);
}

const token = log.providerRef;
const customerEmail = log.portfolioAccount.email ?? "customer@example.test";
const agentName = log.campaign?.agentTemplate?.name ?? "agent";
const systemPrompt = log.campaign?.agentTemplate?.emailConfig?.systemPrompt ?? "(none)";

console.log(`✅  Found gestión: ${log.id}`);
console.log(
  `    Account:       ${log.portfolioAccount.firstName} ${log.portfolioAccount.lastName}`
);
console.log(`    Customer email: ${customerEmail}`);
console.log(`    Agent:         ${agentName}`);
console.log(`    Token:         ${token}`);
console.log(`    System prompt: ${systemPrompt.slice(0, 80)}…`);

// ── Simulate inbound reply ────────────────────────────────────────────────────
console.log(`\n── Simulating inbound reply ──`);
console.log(`    Server:  ${server}/api/email/inbound`);
console.log(`    Message: "${replyText}"`);

const rawBody = JSON.stringify(payload);
const webhookHeaders: Record<string, string> = { "Content-Type": "application/json" };

if (resend.inboundSigningSecret) {
  const svixId = `msg_smoke_${randomUUID()}`;
  const svixTs = String(Math.floor(Date.now() / 1000));
  const keyBytes = Buffer.from(resend.inboundSigningSecret.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", keyBytes)
    .update(`${svixId}.${svixTs}.${rawBody}`)
    .digest("base64");
  webhookHeaders["svix-id"] = svixId;
  webhookHeaders["svix-timestamp"] = svixTs;
  webhookHeaders["svix-signature"] = `v1,${sig}`;
}

const replyTo = `reply+${token}@${resend.inboundDomain}`;
const payload = {
  from: customerEmail,
  to: [replyTo],
  subject: "Re: Su cuenta pendiente",
  text: replyText,
  message_id: `<smoke-reply-${Date.now()}@smoke.test>`,
  in_reply_to: `<original@smoke.test>`,
  headers: { "Auto-Submitted": "no" }
};

try {
  const res = await fetch(`${server}/api/email/inbound`, {
    method: "POST",
    headers: webhookHeaders,
    body: rawBody
  });

  const body = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    console.error(`❌  Webhook rejected (${res.status}):`, body);
    process.exit(1);
  }

  console.log(`\n✅  Autopilot response (${res.status}):`);
  console.log(JSON.stringify(body, null, 2));

  if (body.matched === false) {
    console.error("\n⚠️  matched:false — token not found in DB.");
    console.error("    The gestión might be missing its providerRef. Try engine:sim again.");
  } else {
    console.log("\n── What just happened ──");
    const action = body.action as string | undefined;
    const outcome = body.outcome as string | undefined;
    const replyBodySnippet = (body.replyBody as string | undefined)?.slice(0, 120);

    if (action === "reply") {
      console.log(`    Decision:  reply`);
      if (replyBodySnippet) console.log(`    Reply sent: "${replyBodySnippet}…"`);
      if (outcome) console.log(`    Outcome captured: ${outcome}`);
    } else if (action === "escalate") {
      console.log(`    Decision:  escalate (reply cap reached or escalation triggered)`);
    } else if (action === "resolve") {
      console.log(`    Decision:  resolve`);
      if (outcome) console.log(`    Outcome: ${outcome}`);
    } else if (action === "ignore") {
      console.log(`    Decision:  ignore (auto-reply detected or prompt said to ignore)`);
    } else {
      console.log(`    Action: ${action}`);
    }

    console.log("\n    → Check the Gestiones page — the thread and outcome should be updated.");
  }
} catch (err) {
  const msg = (err as Error).message ?? String(err);
  if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
    console.error("❌  Could not reach the apiserver. Is it running?");
    console.error("    Start it: npm run start:dev --workspace=mods/apiserver");
  } else {
    console.error("❌  Request failed:", msg);
  }
  process.exit(1);
}
