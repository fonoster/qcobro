/**
 * Smoke test for the Resend email channel — both directions.
 *
 * Usage:
 *   npm run email:smoke --workspace=mods/apiserver -- --to=you@example.com
 *   npm run email:smoke --workspace=mods/apiserver -- --to=you@example.com --server=https://xxx.ngrok.app
 *
 * Step 1 — Outbound: sends a real email via Resend and prints the message ID.
 *   Verifies: API key is valid, from-address is verified in Resend.
 *
 * Step 2 — Inbound webhook (synthetic): POSTs a fake Resend inbound payload to the
 *   running apiserver. The token is fresh so the response will be matched:false (no
 *   gestión exists for it) — that is expected and proves the webhook is reachable and
 *   the signing check passes.
 *
 * Step 3 — Full round-trip (manual, with ngrok): instructions are printed at the end.
 *   Reply to the email from Step 1; the autopilot should process the reply.
 */

import { randomUUID } from "node:crypto";
import { config } from "../src/config.js";
import { ResendEmailClient } from "../src/services/resendEmailClient.js";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.slice(2).split("=");
      return [k, rest.join("=")];
    })
);

const to = args.to;
const server = args.server ?? "http://localhost:3000";

if (!to) {
  console.error("Usage: --to=your@email.com  [--server=https://ngrok-url]");
  process.exit(1);
}

const resend = config.resend;
if (!resend) {
  console.error("❌  No 'resend' block in qcobro.json — add it and restart.");
  process.exit(1);
}

// ── Step 1: Outbound ──────────────────────────────────────────────────────────
console.log("\n── Step 1: Outbound (Resend API) ──");

const token = randomUUID();
const replyTo = `reply+${token}@${resend.inboundDomain}`;
const emailClient = new ResendEmailClient(resend);

try {
  const { id } = await emailClient.sendEmail({
    from: resend.fromEmail,
    fromName: resend.fromName,
    to,
    subject: "[smoke] QCobro email channel check",
    body: [
      "This is an automated smoke test from QCobro.",
      "",
      "If you reply to this message the inbound webhook should fire and the",
      "autopilot should process your reply (matched:false for this test token,",
      "but the round-trip proves the pipeline is wired up).",
      "",
      `Token: ${token}`
    ].join("\n"),
    replyTo
  });
  console.log(`✅  Sent — Resend ID: ${id}`);
  console.log(`    To:       ${to}`);
  console.log(`    Reply-To: ${replyTo}`);
} catch (err) {
  console.error("❌  Send failed:", (err as Error).message ?? err);
  process.exit(1);
}

// ── Step 2: Inbound webhook (synthetic) ──────────────────────────────────────
console.log("\n── Step 2: Inbound webhook (synthetic POST) ──");
console.log(`    Target: POST ${server}/api/email/inbound`);

const webhookHeaders: Record<string, string> = { "Content-Type": "application/json" };
if (resend.inboundSigningSecret) {
  webhookHeaders["x-webhook-secret"] = resend.inboundSigningSecret;
  console.log("    Signing secret: present ✓");
} else {
  console.log("    Signing secret: not set (webhook accepts unsigned requests)");
}

const syntheticPayload = {
  from: to,
  to: [replyTo],
  subject: "Re: [smoke] QCobro email channel check",
  text: "I will pay next Friday, no problem.",
  message_id: `<smoke-${Date.now()}@smoke.test>`,
  in_reply_to: `<smoke-original@smoke.test>`,
  headers: { "Auto-Submitted": "no" }
};

try {
  const res = await fetch(`${server}/api/email/inbound`, {
    method: "POST",
    headers: webhookHeaders,
    body: JSON.stringify(syntheticPayload)
  });
  const body = (await res.json()) as Record<string, unknown>;

  if (res.status === 503) {
    console.error("❌  503 — apiserver says Resend is not configured. Is qcobro.json loaded?");
  } else if (res.status === 401) {
    console.error("❌  401 — signing secret mismatch. Check inboundSigningSecret in qcobro.json.");
  } else if (res.ok) {
    console.log(`✅  Webhook accepted (${res.status})`);
    if (body.matched === false) {
      console.log(
        "    matched:false — expected: the token is fresh, no gestión exists for it yet."
      );
      console.log("    To hit the autopilot path, run engine:sim (with Resend configured) so real");
      console.log("    EMAIL gestiones are created, then reply to one of those emails.");
    } else {
      console.log("    Response:", JSON.stringify(body, null, 4));
    }
  } else {
    console.error(`❌  Unexpected ${res.status}:`, body);
  }
} catch (err) {
  const msg = (err as Error).message ?? String(err);
  if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
    console.error("❌  Could not reach the apiserver. Is it running?");
    console.error("    Start it with: npm run start:dev --workspace=mods/apiserver");
  } else {
    console.error("❌  Webhook POST failed:", msg);
  }
}

// ── Step 3: Full round-trip instructions ─────────────────────────────────────
console.log(`
── Step 3: Full round-trip (manual, with ngrok) ──
1. Start ngrok:
     ngrok http 3000

2. In Resend → Inbound → Add domain/route, set the webhook URL to:
     https://<ngrok-url>/api/email/inbound
   Set the webhook secret to match inboundSigningSecret in qcobro.json.

3. Reply to the email just sent to ${to} from any email client.

4. Watch the apiserver logs — you should see the autopilot decision printed,
   and the gestión's channelData will be updated with the thread + outcome.

Note: the token in this smoke test (${token})
is not in the DB, so the autopilot will return matched:false.
For a real round-trip, run 'engine:sim' first so EMAIL gestiones exist,
then reply to one of those actual outbound emails.
`);
