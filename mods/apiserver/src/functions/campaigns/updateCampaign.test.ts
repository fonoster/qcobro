import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUpdateCampaign } from "./updateCampaign.js";
import { ValidationError } from "@qcobro/common";

function makeClient() {
  let updateData: Record<string, unknown> | null = null;
  const client = {
    campaign: {
      findFirstOrThrow: async () =>
        ({
          id: "camp-1",
          workspaceRef: "ws-1",
          startDate: new Date("2026-07-01"),
          endDate: new Date("2026-08-01"),
          status: "PAUSED"
        }) as never,
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updateData = args.data;
        return { id: args.where.id, ...args.data } as never;
      }
    }
  };
  return { client, stats: () => ({ updateData }) };
}

describe("updateCampaign", () => {
  it("rejects an attempt to change agentTemplateId", async () => {
    const { client } = makeClient();
    const fn = createUpdateCampaign(client as never, "ws-1");

    await assert.rejects(() => fn({ id: "camp-1", agentTemplateId: "other" }), ValidationError);
  });

  it("accepts schedule and days-of-week updates", async () => {
    const { client, stats } = makeClient();
    const fn = createUpdateCampaign(client as never, "ws-1");

    await fn({ id: "camp-1", daysOfWeek: [1, 5], endTime: "20:00" });

    assert.deepEqual(stats().updateData?.daysOfWeek, [1, 5]);
    assert.equal(stats().updateData?.endTime, "20:00");
  });

  it("rejects a status change (status is changed via updateStatus)", async () => {
    const { client } = makeClient();
    const fn = createUpdateCampaign(client as never, "ws-1");

    await assert.rejects(() => fn({ id: "camp-1", status: "ACTIVE" } as never), ValidationError);
  });

  it("rejects an end date before the (existing) start date", async () => {
    const { client } = makeClient();
    const fn = createUpdateCampaign(client as never, "ws-1");

    await assert.rejects(() => fn({ id: "camp-1", endDate: "2026-06-01" }), ValidationError);
  });
});
