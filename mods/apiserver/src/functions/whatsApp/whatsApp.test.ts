import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  WhatsAppIntegrationClient,
  WhatsAppIntegrationRecord,
  WhatsAppSenderNumberRecord
} from "@qcobro/common";
import { createUpsertWhatsAppIntegration } from "./upsertWhatsAppIntegration.js";
import { createGetWhatsAppIntegration } from "./getWhatsAppIntegration.js";
import { createAddWhatsAppSenderNumber } from "./addWhatsAppSenderNumber.js";

const WORKSPACE = "ws-test";

const BASE_INTEGRATION: WhatsAppIntegrationRecord = {
  id: "intg-1",
  workspaceRef: WORKSPACE,
  wabaId: "waba-123",
  accessToken: "[ENCRYPTED]",
  verifyToken: "verify-abc",
  defaultLanguage: "es_DO",
  createdAt: new Date(),
  updatedAt: new Date()
};

const BASE_SENDER: WhatsAppSenderNumberRecord = {
  id: "snd-1",
  workspaceRef: WORKSPACE,
  phoneNumberId: "pn-111",
  displayNumber: "+50611100001",
  label: "Principal",
  qualityRating: null,
  capabilities: { messaging: true, calling: false },
  createdAt: new Date(),
  updatedAt: new Date()
};

function makeClient(
  integration: WhatsAppIntegrationRecord | null = null,
  senders: WhatsAppSenderNumberRecord[] = []
) {
  let stored = integration;
  const senderStore = [...senders];

  const client: WhatsAppIntegrationClient = {
    whatsAppIntegration: {
      findUnique: async ({ where }) =>
        stored?.workspaceRef === where.workspaceRef ? stored : null,
      findFirst: async ({ where }) => (stored?.verifyToken === where.verifyToken ? stored : null),
      upsert: async ({ create, update }) => {
        if (stored) {
          stored = { ...stored, ...(update as Partial<WhatsAppIntegrationRecord>) };
        } else {
          stored = { id: "intg-new", ...create } as WhatsAppIntegrationRecord;
        }
        return stored!;
      }
    },
    whatsAppSenderNumber: {
      findUnique: async ({ where }) =>
        senderStore.find((s) => s.phoneNumberId === where.phoneNumberId) ?? null,
      findMany: async ({ where }) =>
        senderStore.filter((s) => s.workspaceRef === where.workspaceRef),
      create: async ({ data }) => {
        const rec = { id: `snd-${senderStore.length + 1}`, ...data } as WhatsAppSenderNumberRecord;
        senderStore.push(rec);
        return rec;
      },
      delete: async ({ where }) => {
        const idx = senderStore.findIndex((s) => s.phoneNumberId === where.phoneNumberId);
        const [removed] = senderStore.splice(idx, 1);
        return removed!;
      }
    }
  };

  return { client, stored: () => stored, senderStore };
}

describe("upsertWhatsAppIntegration", () => {
  it("creates the integration and never returns the accessToken", async () => {
    const { client, stored } = makeClient();
    const fn = createUpsertWhatsAppIntegration(client, WORKSPACE);

    const view = await fn({
      wabaId: "waba-123",
      accessToken: "super-secret-token",
      verifyToken: "verify-abc",
      defaultLanguage: "es_DO"
    });

    // The token was stored.
    assert.equal(stored()?.accessToken, "super-secret-token");
    // The view MUST NOT expose it.
    assert.ok(!("accessToken" in view), "accessToken must never be returned");
    assert.equal(view.connected, true);
    assert.equal(view.wabaId, "waba-123");
    assert.equal(view.defaultLanguage, "es_DO");
  });

  it("rotates credentials in place on a second upsert", async () => {
    const { client, stored } = makeClient(BASE_INTEGRATION);
    const fn = createUpsertWhatsAppIntegration(client, WORKSPACE);

    await fn({
      wabaId: "waba-999",
      accessToken: "new-token",
      verifyToken: "verify-xyz",
      defaultLanguage: "en_US"
    });

    assert.equal(stored()?.wabaId, "waba-999");
    assert.equal(stored()?.accessToken, "new-token");
    assert.equal(stored()?.defaultLanguage, "en_US");
  });

  it("rejects missing wabaId (validation)", async () => {
    const { client } = makeClient();
    const fn = createUpsertWhatsAppIntegration(client, WORKSPACE);
    await assert.rejects(() =>
      fn({ wabaId: "", accessToken: "tok", verifyToken: "v", defaultLanguage: "es_DO" })
    );
  });
});

describe("getWhatsAppIntegration", () => {
  it("returns connected=false when no integration row exists", async () => {
    const { client } = makeClient(null);
    const fn = createGetWhatsAppIntegration(client);
    const view = await fn(WORKSPACE);
    assert.equal(view.connected, false);
  });

  it("returns connected=true with public fields, no token", async () => {
    const { client } = makeClient(BASE_INTEGRATION);
    const fn = createGetWhatsAppIntegration(client);
    const view = await fn(WORKSPACE);
    assert.equal(view.connected, true);
    assert.equal(view.wabaId, "waba-123");
    assert.equal(view.verifyToken, "verify-abc");
    assert.ok(!("accessToken" in view));
  });
});

describe("addWhatsAppSenderNumber", () => {
  it("adds a sender with messaging capability on and calling off", async () => {
    const { client, senderStore } = makeClient(BASE_INTEGRATION);
    const fn = createAddWhatsAppSenderNumber(client, WORKSPACE);

    const rec = await fn({
      phoneNumberId: "pn-999",
      displayNumber: "+50611199999",
      label: "Cobranza Sur"
    });

    assert.equal(rec.phoneNumberId, "pn-999");
    assert.equal(rec.workspaceRef, WORKSPACE);
    assert.equal(rec.qualityRating, null);
    assert.deepEqual(rec.capabilities, { messaging: true, calling: false });
    assert.equal(senderStore.length, 1);
  });

  it("rejects a duplicate phoneNumberId", async () => {
    const { client } = makeClient(BASE_INTEGRATION, [BASE_SENDER]);
    const fn = createAddWhatsAppSenderNumber(client, WORKSPACE);

    await assert.rejects(
      () =>
        fn({
          phoneNumberId: BASE_SENDER.phoneNumberId,
          displayNumber: "+50611100002",
          label: "Duplicado"
        }),
      /already exists/
    );
  });

  it("rejects missing phoneNumberId (validation)", async () => {
    const { client } = makeClient(BASE_INTEGRATION);
    const fn = createAddWhatsAppSenderNumber(client, WORKSPACE);
    await assert.rejects(() =>
      fn({ phoneNumberId: "", displayNumber: "+50611199999", label: "X" })
    );
  });
});
