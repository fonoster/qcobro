import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createFollowUpPaymentPromise } from "./followUpPaymentPromise.js";

function makeClient() {
  const cap: { log?: Record<string, unknown>; stateTouched: boolean } = { stateTouched: false };
  const client = {
    paymentPromise: {
      findFirst: async () => ({ id: "pr-1", portfolioAccountId: "acc-1" }) as never
    },
    agentTemplate: {
      findFirst: async () => ({ id: "tpl-1", workspaceRef: "ws-1", type: "VOICE_AI" }) as never
    },
    accountContactLog: {
      findFirst: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        cap.log = args.data;
        return { id: "log-1", ...args.data } as never;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) =>
        ({ id: args.where.id, ...args.data }) as never
    },
    portfolioAccount: {
      update: async (args: { where: { id: string } }) => ({ id: args.where.id }) as never
    },
    campaignTrigger: { findMany: async () => [] as never },
    campaignAccountState: {
      upsert: async () => {
        cap.stateTouched = true;
        return {} as never;
      }
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(client)
  };
  return { client, cap };
}

describe("followUpPaymentPromise", () => {
  it("writes a campaign-less gestión linked to the promise and agent template", async () => {
    const { client, cap } = makeClient();
    await createFollowUpPaymentPromise(
      client as never,
      "ws-1"
    )({
      paymentPromiseId: "pr-1",
      agentTemplateId: "tpl-1"
    });
    assert.equal(cap.log?.campaignId, null, "no campaign attached");
    assert.equal(cap.log?.agentTemplateId, "tpl-1");
    assert.equal(cap.log?.paymentPromiseId, "pr-1");
    assert.equal(cap.log?.agentType, "VOICE_AI");
    assert.equal(cap.stateTouched, false, "never touches CampaignAccountState");
  });

  it("rejects a missing agent template with a ValidationError before any work", async () => {
    const { client, cap } = makeClient();
    await assert.rejects(
      () =>
        createFollowUpPaymentPromise(
          client as never,
          "ws-1"
        )({
          paymentPromiseId: "pr-1"
        } as never),
      ValidationError
    );
    assert.equal(cap.log, undefined, "no gestión written on invalid input");
  });
});
