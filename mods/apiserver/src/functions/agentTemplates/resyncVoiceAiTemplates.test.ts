import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { VoiceApplicationInput } from "@qcobro/common";
import { createResyncVoiceAiTemplates } from "./resyncVoiceAiTemplates.js";

interface Row {
  templateId: string;
  name: string;
  fonosterAppRef: string | null;
}

function setup(rows: Row[], failing: string[] = []) {
  const updates: { ref: string; input: VoiceApplicationInput }[] = [];
  const saved: { templateId: string; ref: string }[] = [];
  const lines: string[] = [];
  const client = {
    voiceAiConfig: {
      findMany: async () =>
        rows
          .filter((r) => r.fonosterAppRef)
          .map((r) => ({ templateId: r.templateId, template: { name: r.name } })),
      findUnique: async ({ where }: { where: { templateId: string } }) => {
        const r = rows.find((x) => x.templateId === where.templateId)!;
        return {
          templateId: r.templateId,
          fonosterAppName: `qcobro-${r.templateId}`,
          fonosterAppRef: r.fonosterAppRef,
          voice: "86V9x9hrQds83qf7zaGn",
          systemPrompt: "Eres Clara.",
          firstMessage: null,
          language: "es-419",
          idleMessage: "¿Sigue ahí?",
          idleTimeout: 10000,
          idleMaxTimeoutCount: 2,
          allowUserBargeIn: false
        };
      },
      update: async ({
        where,
        data
      }: {
        where: { templateId: string };
        data: { fonosterAppRef: string };
      }) => {
        saved.push({ templateId: where.templateId, ref: data.fonosterAppRef });
      }
    }
  };
  const voiceApplications = {
    createApplication: async () => {
      throw new Error("resync must not create apps");
    },
    updateApplication: async (ref: string, input: VoiceApplicationInput) => {
      if (failing.includes(ref)) throw new Error("NOT_FOUND: application not found");
      updates.push({ ref, input });
      return { ref };
    }
  };
  const resync = createResyncVoiceAiTemplates({
    client: client as never,
    voiceApplications: voiceApplications as never,
    log: (line) => lines.push(line)
  });
  return { resync, updates, saved, lines };
}

describe("resyncVoiceAiTemplates", () => {
  it("updates every VOICE_AI template's app in place, keeping its ref", async () => {
    const { resync, updates, saved, lines } = setup([
      { templateId: "t1", name: "Mora temprana", fonosterAppRef: "app-1" },
      { templateId: "t2", name: "Mora tardía", fonosterAppRef: "app-2" },
      { templateId: "t3", name: "Sin app", fonosterAppRef: null }
    ]);

    const result = await resync();

    assert.deepEqual(result, { resynced: 2, failed: 0 });
    assert.deepEqual(
      updates.map((u) => u.ref),
      ["app-1", "app-2"]
    );
    assert.deepEqual(saved, [
      { templateId: "t1", ref: "app-1" },
      { templateId: "t2", ref: "app-2" }
    ]);
    assert.deepEqual(lines, ["resynced 2 VOICE_AI templates, 0 failed"]);
  });

  it("reports each failure and keeps going", async () => {
    const { resync, updates, lines } = setup(
      [
        { templateId: "t1", name: "Mora temprana", fonosterAppRef: "app-1" },
        { templateId: "t2", name: "Mora tardía", fonosterAppRef: "app-2" }
      ],
      ["app-1"]
    );

    const result = await resync();

    assert.deepEqual(result, { resynced: 1, failed: 1 });
    assert.deepEqual(
      updates.map((u) => u.ref),
      ["app-2"]
    );
    assert.deepEqual(lines, [
      "failed t1 Mora temprana: NOT_FOUND: application not found",
      "resynced 1 VOICE_AI templates, 1 failed"
    ]);
  });
});
