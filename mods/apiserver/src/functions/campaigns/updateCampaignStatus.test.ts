import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUpdateCampaignStatus } from "./updateCampaignStatus.js";
import { ValidationError } from "@qcobro/common";

function makeClient(current: string) {
  let updateData: Record<string, unknown> | null = null;
  const client = {
    campaign: {
      findFirstOrThrow: async () =>
        ({ id: "camp-1", workspaceRef: "ws-1", status: current }) as never,
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updateData = args.data;
        return { id: args.where.id, ...args.data } as never;
      }
    }
  };
  return { client, stats: () => ({ updateData }) };
}

describe("updateCampaignStatus", () => {
  it("allows a valid transition (PAUSED → ACTIVE)", async () => {
    const { client, stats } = makeClient("PAUSED");
    const fn = createUpdateCampaignStatus(client as never, "ws-1");

    await fn({ id: "camp-1", status: "ACTIVE" });

    assert.equal(stats().updateData?.status, "ACTIVE");
  });

  it("rejects an invalid transition (PAUSED → COMPLETED)", async () => {
    const { client, stats } = makeClient("PAUSED");
    const fn = createUpdateCampaignStatus(client as never, "ws-1");

    await assert.rejects(() => fn({ id: "camp-1", status: "COMPLETED" }), ValidationError);
    assert.equal(stats().updateData, null);
  });

  it("restores an ARCHIVED campaign to PAUSED", async () => {
    const { client, stats } = makeClient("ARCHIVED");
    const fn = createUpdateCampaignStatus(client as never, "ws-1");

    await fn({ id: "camp-1", status: "PAUSED" });

    assert.equal(stats().updateData?.status, "PAUSED");
  });

  it("rejects restoring an ARCHIVED campaign straight to ACTIVE", async () => {
    const { client, stats } = makeClient("ARCHIVED");
    const fn = createUpdateCampaignStatus(client as never, "ws-1");

    await assert.rejects(() => fn({ id: "camp-1", status: "ACTIVE" }), ValidationError);
    assert.equal(stats().updateData, null);
  });

  it("is a no-op when the status is unchanged", async () => {
    const { client, stats } = makeClient("ACTIVE");
    const fn = createUpdateCampaignStatus(client as never, "ws-1");

    await fn({ id: "camp-1", status: "ACTIVE" });

    assert.equal(stats().updateData, null);
  });
});
