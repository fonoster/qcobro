import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUpdateAgentTemplate } from "./updateAgentTemplate.js";
import { ValidationError } from "@qcobro/common";

function makeClient(type = "SMS") {
  let baseUpdate: Record<string, unknown> | null = null;
  let smsUpdate: Record<string, unknown> | null = null;

  const client = {
    agentTemplate: {
      findFirstOrThrow: async () => ({ id: "tmpl-1", type, workspaceRef: "ws-1" }) as never,
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        baseUpdate = args.data;
        return { id: args.where.id, ...args.data } as never;
      }
    },
    voiceAiConfig: { update: async () => ({}) as never, create: async () => ({}) as never },
    voicePrerecordedConfig: {
      update: async () => ({}) as never,
      create: async () => ({}) as never
    },
    smsConfig: {
      create: async () => ({}) as never,
      update: async (args: { where: unknown; data: Record<string, unknown> }) => {
        smsUpdate = args.data;
        return {} as never;
      }
    },
    emailConfig: { update: async () => ({}) as never, create: async () => ({}) as never },
    whatsAppConfig: { update: async () => ({}) as never, create: async () => ({}) as never }
  };

  return { client, stats: () => ({ baseUpdate, smsUpdate }) };
}

describe("updateAgentTemplate", () => {
  it("rejects an attempt to change the template type", async () => {
    const { client } = makeClient();
    const fn = createUpdateAgentTemplate(client as never, "ws-1");

    await assert.rejects(() => fn({ id: "tmpl-1", type: "VOICE_AI" }), ValidationError);
  });

  it("updates base fields", async () => {
    const { client, stats } = makeClient();
    const fn = createUpdateAgentTemplate(client as never, "ws-1");

    await fn({ id: "tmpl-1", name: "Renamed" });

    assert.equal(stats().baseUpdate?.name, "Renamed");
  });

  it("applies config to the stored child type", async () => {
    const { client, stats } = makeClient("SMS");
    const fn = createUpdateAgentTemplate(client as never, "ws-1");

    await fn({ id: "tmpl-1", config: { messageBody: "Nuevo mensaje" } });

    assert.equal(stats().smsUpdate?.messageBody, "Nuevo mensaje");
  });

  it("archiving sets archivedAt to a timestamp", async () => {
    const { client, stats } = makeClient();
    const fn = createUpdateAgentTemplate(client as never, "ws-1");

    await fn({ id: "tmpl-1", archived: true });

    assert.ok(stats().baseUpdate?.archivedAt instanceof Date);
  });

  it("restoring clears archivedAt", async () => {
    const { client, stats } = makeClient();
    const fn = createUpdateAgentTemplate(client as never, "ws-1");

    await fn({ id: "tmpl-1", archived: false });

    assert.equal(stats().baseUpdate?.archivedAt, null);
  });
});
