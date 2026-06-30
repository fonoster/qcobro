import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCreateCampaign } from "./createCampaign.js";
import { ValidationError } from "@qcobro/common";

const VALID = {
  name: "Campaña Q3",
  agentTemplateId: "tmpl-1",
  portfolioIds: ["p1", "p2"],
  startDate: "2026-07-01",
  endDate: "2026-08-01",
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "18:00",
  maxAttemptsPerAccount: 5,
  maxAttemptsPerDay: 2
};

interface MakeClientOpts {
  templateWorkspace?: string | null;
  templateType?: string;
  senderNumber?: { id: string; workspaceRef: string } | null;
}

function makeClient({
  templateWorkspace = "ws-1",
  templateType = "SMS",
  senderNumber = undefined
}: MakeClientOpts = {}) {
  let createdCampaign: Record<string, unknown> | null = null;
  let portfolioLinks: Array<{ campaignId: string; portfolioId: string }> = [];

  const client = {
    agentTemplate: {
      findFirst: async () =>
        templateWorkspace
          ? ({ id: "tmpl-1", workspaceRef: templateWorkspace, type: templateType } as never)
          : null
    },
    whatsAppSenderNumber: {
      findUnique: async () => senderNumber ?? null
    },
    campaign: {
      create: async (args: { data: Record<string, unknown> }) => {
        createdCampaign = args.data;
        return { id: "camp-1", ...args.data } as never;
      }
    },
    campaignPortfolio: {
      createMany: async (args: { data: Array<{ campaignId: string; portfolioId: string }> }) => {
        portfolioLinks = args.data;
        return { count: args.data.length };
      }
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(client)
  };

  return { client, stats: () => ({ createdCampaign, portfolioLinks }) };
}

describe("createCampaign", () => {
  it("creates an ACTIVE campaign with its days and links portfolios", async () => {
    const { client, stats } = makeClient();
    const fn = createCreateCampaign(client as never, "ws-1");

    const result = await fn(VALID);

    assert.equal((result as { id: string }).id, "camp-1");
    assert.equal(stats().createdCampaign?.status, "ACTIVE");
    assert.deepEqual(stats().createdCampaign?.daysOfWeek, [1, 2, 3, 4, 5]);
    assert.equal(stats().portfolioLinks.length, 2);
    assert.deepEqual(
      stats().portfolioLinks.map((l) => l.portfolioId),
      ["p1", "p2"]
    );
  });

  it("rejects an empty portfolio list", async () => {
    const { client } = makeClient();
    const fn = createCreateCampaign(client as never, "ws-1");

    await assert.rejects(() => fn({ ...VALID, portfolioIds: [] }), ValidationError);
  });

  it("rejects an empty days-of-week set", async () => {
    const { client } = makeClient();
    const fn = createCreateCampaign(client as never, "ws-1");

    await assert.rejects(() => fn({ ...VALID, daysOfWeek: [] }), ValidationError);
  });

  it("rejects a template from another workspace", async () => {
    const { client } = makeClient({ templateWorkspace: null }); // findFirst (scoped to ws-1) returns null
    const fn = createCreateCampaign(client as never, "ws-1");

    await assert.rejects(() => fn(VALID), ValidationError);
  });

  it("rejects an end date before the start date", async () => {
    const { client } = makeClient();
    const fn = createCreateCampaign(client as never, "ws-1");

    await assert.rejects(
      () => fn({ ...VALID, startDate: "2026-08-01", endDate: "2026-07-01" }),
      ValidationError
    );
  });

  it("WHATSAPP campaign stores the selected sender number id", async () => {
    const { client, stats } = makeClient({
      templateType: "WHATSAPP",
      senderNumber: { id: "snd-1", workspaceRef: "ws-1" }
    });
    const fn = createCreateCampaign(client as never, "ws-1");

    const result = await fn({ ...VALID, whatsAppSenderNumberId: "snd-1" });

    assert.equal((result as { id: string }).id, "camp-1");
    assert.equal(stats().createdCampaign?.whatsAppSenderNumberId, "snd-1");
  });

  it("WHATSAPP campaign rejects when no sender number is provided", async () => {
    const { client } = makeClient({
      templateType: "WHATSAPP",
      senderNumber: { id: "snd-1", workspaceRef: "ws-1" }
    });
    const fn = createCreateCampaign(client as never, "ws-1");

    await assert.rejects(() => fn(VALID), /sender number/);
  });

  it("WHATSAPP campaign rejects when the sender number belongs to another workspace", async () => {
    const { client } = makeClient({
      templateType: "WHATSAPP",
      senderNumber: { id: "snd-1", workspaceRef: "ws-other" }
    });
    const fn = createCreateCampaign(client as never, "ws-1");

    await assert.rejects(
      () => fn({ ...VALID, whatsAppSenderNumberId: "snd-1" }),
      /not found in this workspace/
    );
  });

  it("non-WHATSAPP campaign rejects when a sender number is supplied", async () => {
    const { client } = makeClient({ templateType: "SMS" });
    const fn = createCreateCampaign(client as never, "ws-1");

    await assert.rejects(() => fn({ ...VALID, whatsAppSenderNumberId: "snd-1" }), /Only WhatsApp/);
  });
});
