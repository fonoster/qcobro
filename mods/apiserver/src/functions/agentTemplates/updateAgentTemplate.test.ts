import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUpdateAgentTemplate } from "./updateAgentTemplate.js";
import { ValidationError } from "@qcobro/common";

function makeClient(
  type = "SMS",
  existingPrerecordedConfig: Record<string, unknown> | null = null
) {
  let baseUpdate: Record<string, unknown> | null = null;
  let smsUpdate: Record<string, unknown> | null = null;
  let prerecordedUpdate: Record<string, unknown> | null = null;

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
      findUnique: async () =>
        (existingPrerecordedConfig
          ? {
              repeatDigit: null,
              repeatMessage: null,
              maxRepeats: null,
              optOutDigit: null,
              optOutMessage: null,
              optOutConfirmationMessage: null,
              ...existingPrerecordedConfig
            }
          : null) as never,
      update: async (args: { where: unknown; data: Record<string, unknown> }) => {
        prerecordedUpdate = args.data;
        return {} as never;
      },
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

  return { client, stats: () => ({ baseUpdate, smsUpdate, prerecordedUpdate }) };
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

  describe("VOICE_PRERECORDED DTMF config patch", () => {
    it("adding a full menu from scratch succeeds", async () => {
      const { client, stats } = makeClient("VOICE_PRERECORDED", {});
      const fn = createUpdateAgentTemplate(client as never, "ws-1");

      await fn({
        id: "tmpl-1",
        config: {
          repeatDigit: "1",
          repeatMessage: "Presione 1 para repetir.",
          optOutDigit: "9",
          optOutMessage: "Presione 9 para darse de baja.",
          optOutConfirmationMessage: "Hemos registrado su solicitud."
        }
      });

      assert.equal(stats().prerecordedUpdate?.repeatDigit, "1");
    });

    it("rejects an opt-out digit + message with no confirmation message", async () => {
      const { client } = makeClient("VOICE_PRERECORDED", {});
      const fn = createUpdateAgentTemplate(client as never, "ws-1");

      await assert.rejects(
        () =>
          fn({
            id: "tmpl-1",
            config: {
              optOutDigit: "9",
              optOutMessage: "Presione 9 para darse de baja."
            }
          }),
        ValidationError
      );
    });

    it("adding just the confirmation message when digit + message are already persisted succeeds", async () => {
      const { client, stats } = makeClient("VOICE_PRERECORDED", {
        optOutDigit: "9",
        optOutMessage: "Presione 9 para darse de baja."
      });
      const fn = createUpdateAgentTemplate(client as never, "ws-1");

      await fn({
        id: "tmpl-1",
        config: { optOutConfirmationMessage: "Hemos registrado su solicitud." }
      });

      assert.equal(
        stats().prerecordedUpdate?.optOutConfirmationMessage,
        "Hemos registrado su solicitud."
      );
    });

    it("patching only the message when its digit is already persisted succeeds", async () => {
      const { client, stats } = makeClient("VOICE_PRERECORDED", {
        repeatDigit: "1",
        repeatMessage: "Old message."
      });
      const fn = createUpdateAgentTemplate(client as never, "ws-1");

      await fn({ id: "tmpl-1", config: { repeatMessage: "New message." } });

      assert.equal(stats().prerecordedUpdate?.repeatMessage, "New message.");
    });

    it("rejects setting a message with no persisted or patched digit", async () => {
      const { client } = makeClient("VOICE_PRERECORDED", {});
      const fn = createUpdateAgentTemplate(client as never, "ws-1");

      await assert.rejects(
        () => fn({ id: "tmpl-1", config: { repeatMessage: "Presione 1 para repetir." } }),
        ValidationError
      );
    });

    it("rejects clearing a digit while its persisted message remains implied", async () => {
      // Existing row has repeatDigit "1" + repeatMessage set; patch tries to change
      // optOutDigit to collide with the (untouched, still-persisted) repeatDigit.
      const { client } = makeClient("VOICE_PRERECORDED", {
        repeatDigit: "1",
        repeatMessage: "Presione 1 para repetir."
      });
      const fn = createUpdateAgentTemplate(client as never, "ws-1");

      await assert.rejects(
        () =>
          fn({
            id: "tmpl-1",
            config: { optOutDigit: "1", optOutMessage: "Presione 1 para darse de baja." }
          }),
        ValidationError
      );
    });

    it("a patch touching no DTMF field skips DTMF validation entirely", async () => {
      // Existing row is already in an invalid-looking shape (shouldn't happen in practice,
      // but proves the merge check only runs when the patch actually touches a DTMF field).
      const { client, stats } = makeClient("VOICE_PRERECORDED", {
        fonosterAppName: "old-name"
      } as never);
      const fn = createUpdateAgentTemplate(client as never, "ws-1");

      await fn({ id: "tmpl-1", config: { voice: "voice-y" } });

      assert.equal(stats().prerecordedUpdate?.voice, "voice-y");
    });
  });
});
