import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  type EvalAgentTemplateClient,
  type EvalAgentTemplateRow
} from "@qcobro/common";
import { createPreviewAgentTemplate } from "./previewAgentTemplate.js";

function client(row: EvalAgentTemplateRow | null): EvalAgentTemplateClient {
  return {
    agentTemplate: {
      findFirstOrThrow: async () => {
        if (!row) throw new Error("not found");
        return row;
      }
    }
  };
}

function baseRow(over: Partial<EvalAgentTemplateRow> = {}): EvalAgentTemplateRow {
  return {
    id: "at_1",
    type: "SMS",
    voiceAiConfig: null,
    voicePrerecordedConfig: null,
    smsConfig: null,
    emailConfig: null,
    whatsAppConfig: null,
    ...over
  };
}

const account = {
  fullName: "María López",
  principalAmount: 5000,
  outstandingBalance: 4200,
  daysPastDue: 0,
  termsAmount: 0,
  termsLength: 0,
  missedInstallments: 0,
  currency: "USD"
};

describe("previewAgentTemplate", () => {
  it("renders an existing SMS template's message body against the sample account", async () => {
    const row = baseRow({
      type: "SMS",
      smsConfig: { messageBody: "Hola {{firstName}}, su saldo es {{outstandingBalance}}." }
    });
    const preview = createPreviewAgentTemplate(client(row), "ws_1");
    const result = await preview({ agentTemplateId: "at_1", account });
    assert.equal(result.rendered, "Hola María, su saldo es 4200.");
  });

  it("renders a YAML-defined VOICE_PRERECORDED script without creating anything", async () => {
    const yaml = `
type: VOICE_PRERECORDED
name: Guion
voice: sofia
language: es
script: "Hola {{firstName}}, tiene un saldo de {{outstandingBalance}}."
`;
    const preview = createPreviewAgentTemplate(client(null), "ws_1");
    const result = await preview({ yaml, account });
    assert.equal(result.rendered, "Hola María, tiene un saldo de 4200.");
  });

  it("rejects a VOICE_AI target with a structured validation error, not a render attempt", async () => {
    const preview = createPreviewAgentTemplate(client(null), "ws_1");
    await assert.rejects(
      () =>
        preview({
          yaml: "type: VOICE_AI\nname: X\nvoice: sofia\nsystemPrompt: hi\nlanguage: es",
          account
        }),
      ValidationError
    );
  });

  it("rejects an existing EMAIL template — preview only supports SMS/VOICE_PRERECORDED", async () => {
    const row = baseRow({
      type: "EMAIL",
      emailConfig: { systemPrompt: "x", messageBody: "y", maxReplies: null }
    });
    const preview = createPreviewAgentTemplate(client(row), "ws_1");
    await assert.rejects(() => preview({ agentTemplateId: "at_1", account }), ValidationError);
  });
});
