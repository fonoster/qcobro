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
  delivery: string;
  deliveryReason: string | null;
  outcome: string | null;
  channelData: Record<string, unknown> | null;
}

/** A gestión as it looks right after dispatch, before any Meta status has landed. */
function dispatched(overrides: Partial<Row> = {}): Row {
  return {
    id: "log-1",
    portfolioAccountId: "acct-1",
    delivery: "DISPATCHED",
    deliveryReason: null,
    outcome: null,
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

function status(value: string, ...errorCodes: number[]) {
  return { providerRef: "wamid-1", status: value, at: AT, errorCodes };
}

describe("recordWhatsAppDeliveryStatus — delivery axis", () => {
  it("advances delivery to DELIVERED on a delivered status", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    const result = await record(status("delivered"));

    assert.equal(result.matched, true);
    assert.equal(row!.delivery, "DELIVERED");
    assert.equal(row!.deliveryReason, null);
    assert.equal(row!.channelData?.deliveryStatus, "delivered");
  });

  it("treats a sent status as visibility only", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("sent"));

    assert.equal(row!.delivery, "DISPATCHED");
    assert.equal(row!.channelData?.deliveryStatus, "sent");
  });

  it("maps 131026 to INVALID_DESTINATION", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("failed", 131026));

    assert.equal(row!.delivery, "FAILED");
    assert.equal(row!.deliveryReason, "INVALID_DESTINATION");
  });

  it("maps the re-engagement and quality limits to REJECTED", async () => {
    for (const code of [131047, 131048, 131049]) {
      const { client, row } = makeClient(dispatched());
      const record = createRecordWhatsAppDeliveryStatus(client);

      await record(status("failed", code));

      assert.equal(row!.deliveryReason, "REJECTED", `code ${code}`);
      // These are blocks, not opt-outs — only 131050 carries that meaning.
      assert.equal(row!.outcome, null, `code ${code}`);
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

    assert.equal(row!.delivery, "FAILED");
    assert.equal(row!.deliveryReason, "PROVIDER_ERROR");
  });
});

describe("recordWhatsAppDeliveryStatus — read receipts", () => {
  it("records openedAt without moving any axis", async () => {
    const { client, row } = makeClient(dispatched({ delivery: "DELIVERED" }));
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("read"));

    assert.equal(row!.channelData?.openedAt, AT);
    assert.equal(row!.delivery, "DELIVERED");
    assert.equal(row!.outcome, null);
  });

  it("keeps the first read timestamp", async () => {
    const first = "2026-08-19T09:00:00.000Z";
    const { client, row } = makeClient(
      dispatched({ delivery: "DELIVERED", channelData: { openedAt: first } })
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
    assert.equal(row!.delivery, "FAILED");
    assert.equal(row!.deliveryReason, "REJECTED");
    assert.equal(row!.outcome, "OPT_OUT");
  });

  it("does not overwrite an outcome the conversation already produced", async () => {
    const { client, row } = makeClient(dispatched({ outcome: "PAYMENT_PROMISE" }));
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("failed", 131050));

    assert.equal(row!.outcome, "PAYMENT_PROMISE");
    // ...but the block is still recorded, so it is not lost to the preserved outcome.
    assert.equal(row!.channelData?.optOutAt, AT);
  });

  it("detects 131050 behind a leading generic error code", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    const result = await record(status("failed", 131000, 131050));

    assert.equal(result.matched && result.optOut, true);
    // Reading only the first code would have bucketed this as a vague PROVIDER_ERROR and
    // missed the opt-out entirely.
    assert.equal(row!.deliveryReason, "REJECTED");
    assert.equal(row!.outcome, "OPT_OUT");
  });

  it("ignores 131050 riding on a status that did not fail", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordWhatsAppDeliveryStatus(client);

    const result = await record(status("delivered", 131050));

    // The message reached the recipient, so this is not a suppression signal.
    assert.equal(result.matched && result.optOut, false);
    assert.equal(row!.outcome, null);
    assert.equal(row!.channelData?.optOutAt, undefined);
    assert.equal(row!.delivery, "DELIVERED");
  });
});

describe("recordWhatsAppDeliveryStatus — idempotency and correlation", () => {
  it("never moves delivery back off a finalized value", async () => {
    const { client, row } = makeClient(
      dispatched({ delivery: "FAILED", deliveryReason: "INVALID_DESTINATION" })
    );
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("delivered"));

    assert.equal(row!.delivery, "FAILED");
    assert.equal(row!.deliveryReason, "INVALID_DESTINATION");
  });

  it("leaves a reply-set DELIVERED alone when a failure arrives afterwards", async () => {
    const { client, row } = makeClient(dispatched({ delivery: "DELIVERED" }));
    const record = createRecordWhatsAppDeliveryStatus(client);

    await record(status("failed", 131026));

    assert.equal(row!.delivery, "DELIVERED");
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
    assert.equal(row!.delivery, "DISPATCHED");
  });
});
