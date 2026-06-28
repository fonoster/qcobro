import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { EmailAutopilot, EmailAutopilotDecision } from "@qcobro/common";
import { createEngine } from "./engine.js";
import { createPrismaEngineClient } from "./prismaEngineClient.js";
import { EmulatedEmailClient } from "./emulators.js";
import { createIngestEmailReply } from "../functions/email/ingestEmailReply.js";
import { createPrismaEmailInboundClient } from "../rest/emailInbound.js";
import { createRecordOutcome } from "../functions/campaigns/recordOutcome.js";

// Needs a real Postgres (the dev stack). Skipped unless DATABASE_URL is set.
const RUN = !!process.env.DATABASE_URL;
const TZ = "America/Costa_Rica";
const NOW = new Date("2026-06-23T15:00:00Z"); // Tue 09:00 local — inside a 24/7 window

describe("email channel (integration)", { skip: !RUN ? "no DATABASE_URL" : false }, () => {
  const prisma = new PrismaClient();
  const ws = `test-email-${Date.now()}`;
  const tag = Math.random().toString(36).slice(2, 8);
  const inboundDomain = "inbound.test.local";
  const emailFrom = { email: "cobranza@test.local", inboundDomain };

  async function seed() {
    const tmpl = await prisma.agentTemplate.create({
      data: {
        workspaceRef: ws,
        name: "Email agent",
        type: "EMAIL",
        emailConfig: {
          create: {
            subject: "Saldo {{firstName}}",
            messageBody: "Hola {{firstName}}, regularice su saldo.",
            fromName: "Mikro",
            fromEmail: emailFrom.email,
            systemPrompt: "Eres un agente de cobranza por correo.",
            maxReplies: 2
          }
        }
      }
    });
    const pf = await prisma.portfolio.create({
      data: { workspaceRef: ws, name: "PF", clientId: `cli-${tag}`, currency: "USD" }
    });
    // One account with an email (dispatchable), one without (→ no_email).
    const withEmail = await prisma.portfolioAccount.create({
      data: {
        portfolioId: pf.id,
        externalId: `A-${tag}-1`,
        fullName: "Ana",
        email: `ana-${tag}@test.local`
      }
    });
    await prisma.portfolioAccount.create({
      data: { portfolioId: pf.id, externalId: `A-${tag}-2`, fullName: "Beto", email: null }
    });
    const camp = await prisma.campaign.create({
      data: {
        workspaceRef: ws,
        name: "Email campaign",
        agentTemplateId: tmpl.id,
        status: "ACTIVE",
        startDate: new Date("2026-06-01T00:00:00Z"),
        endDate: new Date("2026-12-31T00:00:00Z"),
        startTime: "00:00",
        endTime: "23:59",
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        maxAttemptsPerAccount: 3,
        maxAttemptsPerDay: 2,
        portfolios: { create: [{ portfolioId: pf.id }] }
      }
    });
    return { campaignId: camp.id, withEmailId: withEmail.id };
  }

  function makeEngine(email: EmulatedEmailClient) {
    return createEngine({
      db: createPrismaEngineClient(prisma),
      reserveRecordClient: prisma,
      outboundCallClient: null,
      smsClient: null,
      emailClient: email,
      emailFrom,
      fonosterNumbers: [],
      twilioFromNumbers: [],
      fonosterPrerecordedAppRef: null,
      clock: { now: () => NOW },
      timezone: TZ,
      voicePerMinute: 0,
      smsPerMinute: 0,
      emailPerMinute: 1000, // high so other active campaigns can't starve this test
      tickSeconds: 60
    });
  }

  const mine = (e: EmulatedEmailClient) => e.emails.filter((m) => String(m.to).includes(tag));

  after(async () => {
    await prisma.campaign.deleteMany({ where: { workspaceRef: ws } });
    await prisma.portfolio.deleteMany({ where: { workspaceRef: ws } });
    await prisma.agentTemplate.deleteMany({ where: { workspaceRef: ws } });
    await prisma.$disconnect();
  });

  it("dispatches EMAIL via the engine and skips accounts with no email", async () => {
    const { campaignId, withEmailId } = await seed();
    const email = new EmulatedEmailClient();

    const report = await makeEngine(email).tick();

    assert.equal(mine(email).length, 1, "only the account with an email is emailed");
    const cr = report.campaigns.find((c) => c.campaignId === campaignId);
    assert.equal(cr?.dispatched, 1);
    assert.ok(
      cr?.decisions.some((d) => d.decision === "no_email"),
      "the email-less account is skipped as no_email"
    );

    const log = await prisma.accountContactLog.findFirst({
      where: { campaignId, portfolioAccountId: withEmailId }
    });
    assert.ok(log?.providerRef, "gestión correlated by the reply-to token");
  });

  it("inbound reply runs the capped autopilot and captures the outcome", async () => {
    const { campaignId, withEmailId } = await seed();
    const email = new EmulatedEmailClient();
    await makeEngine(email).tick();

    const log = await prisma.accountContactLog.findFirst({
      where: { campaignId, portfolioAccountId: withEmailId }
    });
    const token = log!.providerRef!;

    // Autopilot that promises on the first reply, then keeps trying to reply.
    let calls = 0;
    const autopilot: EmailAutopilot = {
      decide: async (): Promise<EmailAutopilotDecision> => {
        calls += 1;
        return calls === 1
          ? {
              action: "reply",
              replyBody: "Gracias, registramos su compromiso.",
              outcome: "PAYMENT_PROMISE",
              objective: { type: "PAYMENT_PROMISE", amount: 500, dueDate: "2026-07-01" }
            }
          : { action: "reply", replyBody: "otra respuesta" };
      }
    };
    const ingest = createIngestEmailReply({
      client: createPrismaEmailInboundClient(prisma),
      autopilot,
      recordOutcome: createRecordOutcome(prisma as never),
      emailClient: email,
      emailFrom,
      maxRepliesDefault: 3,
      now: () => NOW
    });

    const reply = (text: string) =>
      ingest({
        from: `ana-${tag}@test.local`,
        to: [`reply+${token}@${inboundDomain}`],
        subject: "Re: Saldo",
        text,
        messageId: `<m-${Math.random()}@test>`
      });

    // 1st reply: promise captured + agent replies (cap is 2).
    const r1 = await reply("Puedo pagar el viernes.");
    assert.deepEqual(r1, { matched: true, id: log!.id, action: "reply" });

    const afterPromise = await prisma.accountContactLog.findUnique({ where: { id: log!.id } });
    assert.equal(afterPromise?.outcome, "PAYMENT_PROMISE", "outcome captured, not downgraded");
    const promises = await prisma.paymentPromise.findMany({ where: { contactLogId: log!.id } });
    assert.equal(promises.length, 1, "one PaymentPromise");

    // 2nd reply (agentReplyCount now 1 < 2): still replies.
    await reply("¿Me reenvían el enlace?");
    // 3rd reply: agentReplyCount is 2 == cap → escalate, no further send.
    const r3 = await reply("Otra consulta más.");
    assert.equal((r3 as { action: string }).action, "escalate", "cap reached → escalate");

    const fresh = await prisma.accountContactLog.findUnique({ where: { id: log!.id } });
    const thread = (fresh!.channelData as { emailThread: { agentReplyCount: number } }).emailThread;
    assert.equal(thread.agentReplyCount, 2, "agent replies capped at maxReplies=2");
  });
});
