import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { createPrismaWhatsAppInboundClient } from "./whatsAppWebhook.js";

// ── Fake Prisma ─────────────────────────────────────────────────────────────

interface FakeLog {
  id: string;
  portfolioAccountId: string;
  campaignId: string | null;
  agentType: string;
  contactedAt: Date;
  debtAmountSnapshot: number | null;
  providerRef: string | null;
  agentTemplateId: string | null;
  channelData: Record<string, unknown> | null;
  campaign: null;
  portfolioAccount: {
    phone: string;
    fullName: string;
    portfolio: { workspaceRef: string };
  };
}

function makeLog(overrides: Partial<FakeLog> & { channelData: Record<string, unknown> }): FakeLog {
  return {
    id: "log-1",
    portfolioAccountId: "acct-1",
    campaignId: null,
    agentType: "WHATSAPP",
    contactedAt: new Date("2026-01-01T00:00:00Z"),
    debtAmountSnapshot: 1000,
    providerRef: "wamid-1",
    agentTemplateId: null,
    campaign: null,
    portfolioAccount: {
      phone: "+18091234567",
      fullName: "María López",
      portfolio: { workspaceRef: "ws-1" }
    },
    ...overrides
  };
}

function makeFakePrisma(opts: { sender?: { workspaceRef: string } | null; logs?: FakeLog[] }) {
  let findFirstCalls = 0;
  const logs = opts.logs ?? [];

  const prisma = {
    whatsAppSenderNumber: {
      findUnique: async () => opts.sender ?? null
    },
    accountContactLog: {
      findFirst: async (args: {
        where: {
          agentType: string;
          channelData: { path: string[]; equals: string };
          portfolioAccount: { portfolio: { workspaceRef: string } };
        };
        orderBy: { contactedAt: "desc" };
      }) => {
        findFirstCalls++;
        const candidates = logs
          .filter((l) => l.agentType === args.where.agentType)
          .filter(
            (l) =>
              l.portfolioAccount.portfolio.workspaceRef ===
              args.where.portfolioAccount.portfolio.workspaceRef
          )
          .filter((l) => {
            const to = l.channelData?.to;
            return typeof to === "string" && to === args.where.channelData.equals;
          })
          .sort((a, b) => b.contactedAt.getTime() - a.contactedAt.getTime());
        return candidates[0] ?? null;
      }
    },
    agentTemplate: {
      findUnique: async () => null
    },
    workspaceSettings: {
      findUnique: async () => ({ currency: "USD" })
    },
    _findFirstCalls: () => findFirstCalls
  };

  return prisma as unknown as PrismaClient & { _findFirstCalls: () => number };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("createPrismaWhatsAppInboundClient — loadByPhoneAndSender", () => {
  it("matches an inbound reply to its dispatch by canonical E.164 via a direct query", async () => {
    const log = makeLog({ channelData: { to: "+18091234567" } });
    const prisma = makeFakePrisma({ sender: { workspaceRef: "ws-1" }, logs: [log] });
    const client = createPrismaWhatsAppInboundClient(prisma);

    // Meta delivers the inbound `from` digits-only, no `+`.
    const result = await client.loadByPhoneAndSender("pn-1", "18091234567");

    assert.ok(result);
    assert.equal(result?.id, "log-1");
    assert.equal(result?.portfolioAccountId, "acct-1");
    assert.equal(prisma._findFirstCalls(), 1);
  });

  it("finds no match when channelData.to differs from the normalized inbound number", async () => {
    const log = makeLog({ channelData: { to: "+18095550000" } });
    const prisma = makeFakePrisma({ sender: { workspaceRef: "ws-1" }, logs: [log] });
    const client = createPrismaWhatsAppInboundClient(prisma);

    const result = await client.loadByPhoneAndSender("pn-1", "18091234567");

    assert.equal(result, null);
  });

  it("short-circuits to null without querying the datastore when the inbound number doesn't parse", async () => {
    const prisma = makeFakePrisma({ sender: { workspaceRef: "ws-1" }, logs: [] });
    const client = createPrismaWhatsAppInboundClient(prisma);

    const result = await client.loadByPhoneAndSender("pn-1", "not-a-phone-number");

    assert.equal(result, null);
    assert.equal(prisma._findFirstCalls(), 0);
  });

  it("scopes the match to the sender's workspace, excluding other workspaces' logs", async () => {
    const log = makeLog({
      channelData: { to: "+18091234567" },
      portfolioAccount: {
        phone: "+18091234567",
        fullName: "Other Workspace",
        portfolio: { workspaceRef: "ws-other" }
      }
    });
    const prisma = makeFakePrisma({ sender: { workspaceRef: "ws-1" }, logs: [log] });
    const client = createPrismaWhatsAppInboundClient(prisma);

    const result = await client.loadByPhoneAndSender("pn-1", "18091234567");

    assert.equal(result, null);
  });

  it("returns null when the sender's phoneNumberId is unknown", async () => {
    const prisma = makeFakePrisma({ sender: null, logs: [] });
    const client = createPrismaWhatsAppInboundClient(prisma);

    const result = await client.loadByPhoneAndSender("unknown-pn", "18091234567");

    assert.equal(result, null);
    assert.equal(prisma._findFirstCalls(), 0);
  });
});
