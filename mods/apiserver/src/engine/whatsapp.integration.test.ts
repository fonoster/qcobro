import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createEngine } from "./engine.js";
import { createPrismaEngineClient } from "./prismaEngineClient.js";
import { EmulatedWhatsAppClient } from "./emulators.js";

// Needs a real Postgres (the dev stack). Skipped unless DATABASE_URL is set.
const RUN = !!process.env.DATABASE_URL;
const NOW = new Date("2026-06-23T15:00:00Z"); // Tue 09:00 local — inside the window

/**
 * WHATSAPP channel golden path (task 9.5): create a workspace WABA integration + sender
 * number, create a WHATSAPP campaign, tick the engine, and verify it resolves the tenant
 * integration (not a global pool like voice/SMS), dispatches via the emulator using the
 * workspace's default language, and records one gestión with the emulated Meta message id
 * as `providerRef`.
 */
describe("whatsapp channel (integration)", { skip: !RUN ? "no DATABASE_URL" : false }, () => {
  const prisma = new PrismaClient();
  const ws = `test-whatsapp-${Date.now()}`;
  const tag = Math.random().toString(36).slice(2, 8);
  const phoneNumberId = `pn-${tag}`;
  let senderId = "";

  // The integration + sender are workspace-unique, so they're seeded once and shared by
  // every campaign created below (mirrors production: one WABA per workspace, many campaigns).
  async function seedIntegration() {
    await prisma.whatsAppIntegration.create({
      data: {
        workspaceRef: ws,
        wabaId: `waba-${tag}`,
        accessToken: "test-token",
        verifyToken: `verify-${tag}`,
        defaultLanguage: "es_MX"
      }
    });
    const sender = await prisma.whatsAppSenderNumber.create({
      data: {
        workspaceRef: ws,
        phoneNumberId,
        displayNumber: "+525500000000",
        label: "Principal",
        capabilities: { messaging: true, calling: false }
      }
    });
    senderId = sender.id;
  }

  async function seedCampaign() {
    const campTag = Math.random().toString(36).slice(2, 8);
    const tmpl = await prisma.agentTemplate.create({
      data: {
        workspaceRef: ws,
        name: "WhatsApp agent",
        type: "WHATSAPP",
        whatsAppConfig: {
          create: {
            metaTemplateId: "meta-tmpl-1",
            templateName: "saldo_pendiente",
            messageBody: "Hola {{firstName}}, su saldo es {{outstandingBalance}}."
          }
        }
      }
    });
    const pf = await prisma.portfolio.create({
      data: { workspaceRef: ws, name: "PF", clientId: `cli-${campTag}` }
    });
    const account = await prisma.portfolioAccount.create({
      data: {
        portfolioId: pf.id,
        externalId: `A-${campTag}`,
        fullName: "Ana",
        phone: `+1555${campTag}00`,
        outstandingBalance: 4800
      }
    });
    const camp = await prisma.campaign.create({
      data: {
        workspaceRef: ws,
        name: "WhatsApp campaign",
        agentTemplateId: tmpl.id,
        status: "ACTIVE",
        startDate: new Date("2026-06-01T00:00:00Z"),
        endDate: new Date("2026-12-31T00:00:00Z"),
        startTime: "08:00",
        endTime: "18:00",
        daysOfWeek: [1, 2, 3, 4, 5],
        maxAttemptsPerAccount: 3,
        maxAttemptsPerDay: 1,
        whatsAppSenderNumberId: senderId,
        portfolios: { create: [{ portfolioId: pf.id }] }
      }
    });
    return { campaignId: camp.id, accountId: account.id };
  }

  function makeEngine(wa: EmulatedWhatsAppClient, opts: { missingIntegration?: boolean } = {}) {
    return createEngine({
      db: createPrismaEngineClient(prisma),
      reserveRecordClient: prisma,
      outboundCallClient: null,
      smsClient: null,
      fonosterNumbers: [],
      twilioFromNumbers: [],
      fonosterPrerecordedAppRef: null,
      clock: { now: () => NOW },
      voicePerMinute: 0,
      smsPerMinute: 0,
      emailPerMinute: 0,
      whatsAppPerMinute: 60,
      tickSeconds: 60,
      // Stands in for `resolveWhatsAppClient`: reads the real tenant integration + sender
      // rows (proving they were resolved by the engine per-call, not a global pool) but
      // swaps the network-calling Meta client for the emulator.
      resolveWhatsApp: async (workspaceRef, resolvedPhoneNumberId) => {
        if (opts.missingIntegration) return null;
        const integration = await prisma.whatsAppIntegration.findUnique({
          where: { workspaceRef }
        });
        const sender = await prisma.whatsAppSenderNumber.findUnique({
          where: { phoneNumberId: resolvedPhoneNumberId }
        });
        if (!integration || !sender || sender.workspaceRef !== workspaceRef) return null;
        return { client: wa, languageCode: integration.defaultLanguage };
      }
    });
  }

  before(async () => {
    await prisma.campaign.updateMany({
      where: { status: "ACTIVE", workspaceRef: { not: ws } },
      data: { status: "PAUSED" }
    });
    await seedIntegration();
  });

  after(async () => {
    await prisma.campaign.deleteMany({ where: { workspaceRef: ws } });
    await prisma.portfolio.deleteMany({ where: { workspaceRef: ws } });
    await prisma.agentTemplate.deleteMany({ where: { workspaceRef: ws } });
    await prisma.whatsAppSenderNumber.deleteMany({ where: { workspaceRef: ws } });
    await prisma.whatsAppIntegration.deleteMany({ where: { workspaceRef: ws } });
    await prisma.campaign.updateMany({
      where: { status: "PAUSED", workspaceRef: { not: ws } },
      data: { status: "ACTIVE" }
    });
    await prisma.$disconnect();
  });

  it("resolves the tenant integration, dispatches via the emulator, and records the gestión", async () => {
    const { campaignId, accountId } = await seedCampaign();
    const wa = new EmulatedWhatsAppClient({ from: phoneNumberId });

    const report = await makeEngine(wa).tick();

    assert.equal(wa.messages.length, 1, "one WhatsApp template send");
    const [sent] = wa.messages;
    assert.equal(sent.kind, "template");
    assert.equal(sent.templateName, "saldo_pendiente");
    assert.deepEqual(sent.params, [
      { parameterName: "firstName", text: "Ana" },
      { parameterName: "outstandingBalance", text: "4800" }
    ]);

    const cr = report.campaigns.find((c) => c.campaignId === campaignId);
    assert.equal(cr?.dispatched, 1);

    const logs = await prisma.accountContactLog.findMany({
      where: { campaignId, portfolioAccountId: accountId }
    });
    assert.equal(logs.length, 1, "one gestión recorded");
    const [log] = logs;
    assert.equal(log.agentType, "WHATSAPP");
    assert.equal(
      log.providerRef,
      wa.messages[0].ref,
      "providerRef is the emulated Meta message id"
    );
  });

  it("skips the campaign without consuming the attempt when the workspace has no integration", async () => {
    const { campaignId } = await seedCampaign();

    // Tick 1: no integration resolved — the engine must bail before reserving the attempt.
    const missing = new EmulatedWhatsAppClient({ from: phoneNumberId });
    const first = await makeEngine(missing, { missingIntegration: true }).tick();
    assert.equal(missing.messages.length, 0, "nothing dispatched without an integration");
    const cr1 = first.campaigns.find((c) => c.campaignId === campaignId);
    assert.equal(cr1?.dispatched, 0);
    assert.ok(
      cr1?.decisions.some((d) => d.decision === "dispatch_failed"),
      "resolveWhatsApp returning null surfaces as a failed dispatch, not a silent skip"
    );

    // Tick 2: integration now resolves — the account is still eligible (attempt wasn't
    // consumed by tick 1), so it dispatches normally.
    const healthy = new EmulatedWhatsAppClient({ from: phoneNumberId });
    const second = await makeEngine(healthy).tick();
    assert.equal(healthy.messages.length, 1, "the un-consumed attempt dispatches on retry");
    const cr2 = second.campaigns.find((c) => c.campaignId === campaignId);
    assert.equal(cr2?.dispatched, 1);
  });
});
