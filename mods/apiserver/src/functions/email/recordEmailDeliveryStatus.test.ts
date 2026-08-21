import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import {
  createRecordEmailDeliveryStatus,
  type EmailDeliveryStatusClient
} from "./recordEmailDeliveryStatus.js";

interface Row {
  id: string;
  providerRef: string | null;
  entrega: string;
  deliveryReason: string | null;
  resultado: string | null;
  channelData: Record<string, unknown> | null;
}

/** A gestión as it looks right after dispatch, before any Resend event has landed. */
function dispatched(overrides: Partial<Row> = {}): Row {
  return {
    id: "log-1",
    providerRef: "token-1",
    entrega: "DISPATCHED",
    deliveryReason: null,
    resultado: null,
    channelData: null,
    ...overrides
  };
}

/**
 * Stub client over a single row. `findFirst` honours the `agentType` scope so a same-id row on
 * another channel is not picked up, and `update` mirrors Prisma by writing only the keys the
 * caller actually passed.
 */
function makeClient(row: Row | null) {
  const state = row;
  const client: EmailDeliveryStatusClient = {
    accountContactLog: {
      findFirst: (async ({ where }) => {
        if (!state || where.agentType !== "EMAIL") return null;
        return state;
      }) as EmailDeliveryStatusClient["accountContactLog"]["findFirst"],
      update: (async ({ data }) => {
        Object.assign(state!, data);
        return state;
      }) as EmailDeliveryStatusClient["accountContactLog"]["update"]
    }
  };
  return { client, row: state };
}

const AT = "2026-08-20T12:00:00.000Z";

function event(type: string, extra: Record<string, unknown> = {}) {
  return { providerMessageId: "resend-1", type, at: AT, ...extra };
}

describe("recordEmailDeliveryStatus — delivery axis", () => {
  it("advances entrega to DELIVERED on email.delivered", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordEmailDeliveryStatus(client);

    const result = await record(event("email.delivered"));

    assert.equal(result.matched, true);
    assert.equal(row!.entrega, "DELIVERED");
    assert.equal(row!.deliveryReason, null);
    assert.equal(row!.channelData?.deliveryStatus, "email.delivered");
  });

  it("returns the matched gestión's providerRef so the event can be attributed", async () => {
    const { client } = makeClient(dispatched({ providerRef: "token-42" }));
    const record = createRecordEmailDeliveryStatus(client);

    const result = await record(event("email.delivered"));

    assert.equal(result.matched && result.providerRef, "token-42");
  });

  it("maps a permanent bounce to INVALID_DESTINATION", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.bounced", { bounceType: "Permanent", bounceSubType: "NoEmail" }));

    assert.equal(row!.entrega, "FAILED");
    assert.equal(row!.deliveryReason, "INVALID_DESTINATION");
  });

  it("maps a suppressed bounce to REJECTED — the address works, the send was blocked", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.bounced", { bounceType: "Permanent", bounceSubType: "Suppressed" }));

    assert.equal(row!.deliveryReason, "REJECTED");
  });

  it("maps a transient bounce to UNREACHABLE so a retry stays on the table", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.bounced", { bounceType: "Transient", bounceSubType: "MailboxFull" }));

    assert.equal(row!.entrega, "FAILED");
    assert.equal(row!.deliveryReason, "UNREACHABLE");
  });

  it("falls back to the type when the subtype is unmapped", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.bounced", { bounceType: "Permanent", bounceSubType: "Mystery" }));

    assert.equal(row!.deliveryReason, "INVALID_DESTINATION");
  });

  it("falls back to PROVIDER_ERROR when there is no bounce block at all", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.failed"));

    assert.equal(row!.entrega, "FAILED");
    assert.equal(row!.deliveryReason, "PROVIDER_ERROR");
  });

  it("treats email.sent as visibility only", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.sent"));

    assert.equal(row!.entrega, "DISPATCHED");
    assert.equal(row!.deliveryReason, null);
    assert.equal(row!.channelData?.deliveryStatus, "email.sent");
  });

  it("treats email.delivery_delayed as visibility only", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.delivery_delayed"));

    assert.equal(row!.entrega, "DISPATCHED");
    assert.equal(row!.channelData?.deliveryStatus, "email.delivery_delayed");
  });
});

describe("recordEmailDeliveryStatus — opens", () => {
  it("records openedAt without moving any axis", async () => {
    const { client, row } = makeClient(dispatched({ entrega: "DELIVERED" }));
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.opened"));

    assert.equal(row!.channelData?.openedAt, AT);
    assert.equal(row!.entrega, "DELIVERED");
    assert.equal(row!.resultado, null);
  });

  it("does not advance entrega on its own — a pixel load is not a delivery receipt", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.opened"));

    assert.equal(row!.entrega, "DISPATCHED");
    assert.equal(row!.channelData?.openedAt, AT);
  });

  it("keeps the first open when an image proxy re-fetches later", async () => {
    const first = "2026-08-19T09:00:00.000Z";
    const { client, row } = makeClient(
      dispatched({ entrega: "DELIVERED", channelData: { openedAt: first } })
    );
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.opened"));

    assert.equal(row!.channelData?.openedAt, first);
  });
});

describe("recordEmailDeliveryStatus — complaints", () => {
  it("records OPT_OUT and treats the complaint as proof of delivery", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.complained"));

    assert.equal(row!.entrega, "DELIVERED");
    assert.equal(row!.resultado, "OPT_OUT");
  });

  it("does not overwrite a resultado the conversation already produced", async () => {
    const { client, row } = makeClient(dispatched({ resultado: "PAYMENT_PROMISE" }));
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.complained"));

    assert.equal(row!.resultado, "PAYMENT_PROMISE");
  });
});

describe("recordEmailDeliveryStatus — idempotency and correlation", () => {
  it("never moves entrega back off a finalized value", async () => {
    const { client, row } = makeClient(
      dispatched({ entrega: "FAILED", deliveryReason: "INVALID_DESTINATION" })
    );
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.delivered"));

    assert.equal(row!.entrega, "FAILED");
    assert.equal(row!.deliveryReason, "INVALID_DESTINATION");
  });

  it("leaves a reply-set DELIVERED alone when a bounce arrives afterwards", async () => {
    const { client, row } = makeClient(dispatched({ entrega: "DELIVERED" }));
    const record = createRecordEmailDeliveryStatus(client);

    await record(event("email.bounced", { bounceType: "Permanent", bounceSubType: "NoEmail" }));

    assert.equal(row!.entrega, "DELIVERED");
    assert.equal(row!.deliveryReason, null);
  });

  it("reports no match when the message id correlates to nothing", async () => {
    const { client } = makeClient(null);
    const record = createRecordEmailDeliveryStatus(client);

    const result = await record(event("email.delivered"));

    assert.equal(result.matched, false);
  });

  it("rejects an event with no message id before touching the database", async () => {
    const { client, row } = makeClient(dispatched());
    const record = createRecordEmailDeliveryStatus(client);

    await assert.rejects(
      () => record({ providerMessageId: "", type: "email.delivered", at: AT }),
      ValidationError
    );
    assert.equal(row!.entrega, "DISPATCHED");
  });
});
