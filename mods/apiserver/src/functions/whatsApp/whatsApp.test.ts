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

const API_SETTINGS = { apiBaseUrl: "https://graph.facebook.com", apiVersion: "v18.0" };

const BASE_INTEGRATION: WhatsAppIntegrationRecord = {
  id: "intg-1",
  workspaceRef: WORKSPACE,
  wabaId: "waba-123",
  accessToken: "[ENCRYPTED]",
  verifyToken: "verify-abc",
  defaultLanguage: "es_DO",
  lastCheckedAt: null,
  lastCheckedOk: null,
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
          stored = {
            id: "intg-new",
            lastCheckedAt: null,
            lastCheckedOk: null,
            ...create
          } as WhatsAppIntegrationRecord;
        }
        return stored!;
      },
      update: async ({ where, data }) => {
        if (!stored || stored.workspaceRef !== where.workspaceRef) {
          throw new Error("no integration to update");
        }
        stored = { ...stored, ...(data as Partial<WhatsAppIntegrationRecord>) };
        return stored;
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

  it("clears the cached reachability check on rotation, so it's re-validated next read", async () => {
    const checked = { ...BASE_INTEGRATION, lastCheckedAt: new Date(), lastCheckedOk: true };
    const { client, stored } = makeClient(checked);
    const fn = createUpsertWhatsAppIntegration(client, WORKSPACE);

    await fn({
      wabaId: "waba-999",
      accessToken: "new-token",
      verifyToken: "verify-xyz",
      defaultLanguage: "en_US"
    });

    assert.equal(
      stored()?.lastCheckedAt,
      null,
      "a stale check for the old token must not carry over to the new one"
    );
    assert.equal(stored()?.lastCheckedOk, null);
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
  it("returns connected=false when no integration row exists (and never calls Meta)", async () => {
    const { client } = makeClient(null);
    let calls = 0;
    const fn = createGetWhatsAppIntegration(client, API_SETTINGS, async () => {
      calls++;
      return true;
    });
    const view = await fn(WORKSPACE);
    assert.equal(view.connected, false);
    assert.equal(calls, 0, "no row means nothing to check");
  });

  it("returns connected=true with public fields, no token, when the check succeeds", async () => {
    const { client } = makeClient(BASE_INTEGRATION);
    const fn = createGetWhatsAppIntegration(client, API_SETTINGS, async () => true);
    const view = await fn(WORKSPACE);
    assert.equal(view.connected, true);
    assert.equal(view.wabaId, "waba-123");
    assert.equal(view.verifyToken, "verify-abc");
    assert.ok(!("accessToken" in view));
  });

  it("returns connected=false when a stored row's token/WABA no longer checks out", async () => {
    const { client } = makeClient(BASE_INTEGRATION);
    const fn = createGetWhatsAppIntegration(client, API_SETTINGS, async () => false);
    const view = await fn(WORKSPACE);
    assert.equal(
      view.connected,
      false,
      "a row existing is not enough — a revoked/expired token must not show connected"
    );
  });

  it("treats a throwing checker as not connected instead of failing the read", async () => {
    const { client } = makeClient(BASE_INTEGRATION);
    const fn = createGetWhatsAppIntegration(client, API_SETTINGS, async () => {
      throw new Error("network down");
    });
    const view = await fn(WORKSPACE);
    assert.equal(view.connected, false);
  });

  it("passes the row's wabaId/accessToken and config API settings to the checker", async () => {
    const { client } = makeClient(BASE_INTEGRATION);
    let seen: unknown;
    const fn = createGetWhatsAppIntegration(client, API_SETTINGS, async (settings) => {
      seen = settings;
      return true;
    });
    await fn(WORKSPACE);
    assert.deepEqual(seen, {
      wabaId: "waba-123",
      accessToken: "[ENCRYPTED]",
      apiBaseUrl: API_SETTINGS.apiBaseUrl,
      apiVersion: API_SETTINGS.apiVersion
    });
  });

  it("persists the check result on the row (lastCheckedAt/lastCheckedOk)", async () => {
    const { client, stored } = makeClient(BASE_INTEGRATION);
    const fn = createGetWhatsAppIntegration(client, API_SETTINGS, async () => true);
    await fn(WORKSPACE);
    assert.equal(stored()?.lastCheckedOk, true);
    assert.ok(stored()?.lastCheckedAt instanceof Date);
  });

  it("reuses a fresh cached result without calling the checker again", async () => {
    const fresh = { ...BASE_INTEGRATION, lastCheckedAt: new Date(), lastCheckedOk: true };
    const { client } = makeClient(fresh);
    let calls = 0;
    const fn = createGetWhatsAppIntegration(client, API_SETTINGS, async () => {
      calls++;
      return false; // if this were called, connected would flip to false
    });
    const view = await fn(WORKSPACE);
    assert.equal(view.connected, true, "cached lastCheckedOk should be trusted");
    assert.equal(calls, 0, "the checker must not run again inside the TTL");
  });

  it("re-checks once the cached result is stale", async () => {
    const stale = {
      ...BASE_INTEGRATION,
      lastCheckedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago, past the 5 min TTL
      lastCheckedOk: true
    };
    const { client } = makeClient(stale);
    let calls = 0;
    const fn = createGetWhatsAppIntegration(client, API_SETTINGS, async () => {
      calls++;
      return false;
    });
    const view = await fn(WORKSPACE);
    assert.equal(calls, 1, "a stale cache must trigger a fresh check");
    assert.equal(view.connected, false, "the fresh (failing) result wins over the stale cache");
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
