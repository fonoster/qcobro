import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import {
  createRecordWhatsAppDeliveryStatus,
  type WhatsAppDeliveryStatusClient
} from "./recordWhatsAppDeliveryStatus.js";

interface Row {
  id: string;
  portfolioAccountId: string;
  entrega: string;
  deliveryReason: string | null;
  resultado: string | null;
  channelData: Record<string, unknown> | null;
}

/** A gestión as it looks right after dispatch, before any Meta status has landed. */
function dispatched(overrides: Partial<Row> = {}): Row {
  return {
    id: "log-1",
    portfolioAccountId: "acct-1",
    entrega: "DISPATCHED",
    deliveryReason: null,
    resultado: null,
    channelData: null,
    ...overrides
  };
}

/**
 * Stub client over a single row. `findFirst` honours the `agentType` scope so a same-ref row
 * on another channel is not picked up, and `update` mirrors Prisma by writing only the keys
 * the caller actually passed.
 */
function makeClient(row: Row | null) {
  const state = row;
  const client: WhatsAppDeliveryStatusClient = {
    accountContactLog: {
      findFirst: (async ({ where }) => {
        if (!state || where.agentType !== "WHATSAPP") return null;
        return state;
      }) as WhatsAppDeliveryStatusClient["accountContactLog"]["findFirst"],
      update: (async ({ data }) => {
        Object.assign(state!, data);
        return state;
      }) as WhatsAppDeliveryStatusClient["accountContactLog"]["update"]
    }
  };
  return { client, row: state };
}

const AT = "2026-08-20T12:00:00.000Z";

function status(value: string, errorCode?: number) {
  return { providerRef: "wamid-1", status: value, at: AT, errorCode };
}

describe("recordWhatsAppDeliveryStatus — delivery axis", () => {
  it("advances entrega to DELIVERED on a delivered status", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    const result = await record(status("delivered"));

    assert.equal(result.matched, true);
    assert.equal(row!.entrega, "DELIVERED");
    assert.equal(row!.deliveryReason, null);
    assert.equal(row!.channelData?.deliveryStatus, "delivered");
  });

  it("treats a sent status as visibility only", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("sent"));

    assert.equal(row!.entrega, "DISPATCHED");
    assert.equal(row!.channelData?.deliveryStatus, "sent");
  });

  it("maps 131026 to INVALID_DESTINATION", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("failed", 131026));

    assert.equal(row!.entrega, "FAILED");
    assert.equal(row!.deliveryReason, "INVALID_DESTINATION");
  });

  it("maps the re-engagement and quality limits to REJECTED", async () => {
    for (const code of [131047, 131048, 131049]) {
      const { client, row } = makeClient(dispatched());
      const record = createRecordWhatsAppDeliveryStatus(client);

      await record(status("failed", code));

      assert.equal(row!.deliveryReason, "REJECTED", `code ${code}`);
      // These are blocks, not opt-outs — only 131050 carries that meaning.
      assert.equal(row!.resultado, null, `code ${code}`);
    }
  });

  it("falls back to PROVIDER_ERROR for an unmapped code", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("failed", 999));

    assert.equal(row!.deliveryReason, "PROVIDER_ERROR");
  });

  it("falls back to PROVIDER_ERROR when the status carries no code", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("failed"));

    assert.equal(row!.entrega, "FAILED");
    assert.equal(row!.deliveryReason, "PROVIDER_ERROR");
  });
});

describe("recordWhatsAppDeliveryStatus — read receipts", () => {
  it("records openedAt without moving any axis", async () => {
    const { client, row } = makeClient(dispatched({ entrega: "DELIVERED" }));
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("read"));

    assert.equal(row!.channelData?.openedAt, AT);
    assert.equal(row!.entrega, "DELIVERED");
    assert.equal(row!.resultado, null);
  });

  it("keeps the first read timestamp", async () => {
    const first = "2026-08-19T09:00:00.000Z";
    const { client, row } = makeClient(
      dispatched({ entrega: "DELIVERED", channelData: { openedAt: first } })
    );
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("read"));

    assert.equal(row!.channelData?.openedAt, first);
  });
});

describe("recordWhatsAppDeliveryStatus — opt-out", () => {
  it("records 131050 on both axes", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    const result = await record(status("failed", 131050));

    assert.equal(result.matched && result.optOut, true);
    assert.equal(row!.entrega, "FAILED");
    assert.equal(row!.deliveryReason, "REJECTED");
    assert.equal(row!.resultado, "OPT_OUT");
  });

  it("does not overwrite a resultado the conversation already produced", async () => {
    const { client, row } = makeClient(dispatched({ resultado: "PAYMENT_PROMISE" }));
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("failed", 131050));

    assert.equal(row!.resultado, "PAYMENT_PROMISE");
  });
});

describe("recordWhatsAppDeliveryStatus — idempotency and correlation", () => {
  it("never moves entrega back off a finalized value", async () => {
    const { client, row } = makeClient(
      dispatched({ entrega: "FAILED", deliveryReason: "INVALID_DESTINATION" })
    );
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("delivered"));

    assert.equal(row!.entrega, "FAILED");
    assert.equal(row!.deliveryReason, "INVALID_DESTINATION");
  });

  it("leaves a reply-set DELIVERED alone when a failure arrives afterwards", async () => {
    const { client, row } = makeClient(dispatched({ entrega: "DELIVERED" }));
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("failed", 131026));

    assert.equal(row!.entrega, "DELIVERED");
    assert.equal(row!.deliveryReason, null);
  });

  it("reports no match when the ref correlates to nothing", async () => {
    const { client } = makeClient(null);
    const record = createRecordWhatsAppDeliveryStatus(client);

    const result = await record(status("delivered"));

    assert.equal(result.matched, false);
  });

  it("rejects a status with no ref before touching the database", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    await assert.rejects(
      () => record({ providerRef: "", status: "delivered", at: AT }),
      ValidationError
    );
    assert.equal(row!.entrega, "DISPATCHED");
  });
});
