import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { appRouter } from "../index.js";
import type { Context } from "../context.js";
import {
  contactLogEvents,
  CONTACT_LOG_CHANGED,
  type ContactLogChangeEvent
} from "../../services/contactLogEvents.js";

const PROMISE = {
  id: "pp-1",
  contactLogId: "log-1",
  portfolioAccountId: "acc-1",
  status: "PENDING",
  amount: 500
};

/**
 * A Prisma stub whose `$transaction` records when it has committed (its callback resolved).
 * The stub's writes don't run the change-signal extension, so any event a test sees comes
 * from the router.
 */
function makePrisma() {
  const state = { committed: false };
  const tx = {
    paymentPromise: {
      findFirst: async () => PROMISE,
      update: async (args: { data: { status: string } }) => ({ ...PROMISE, ...args.data })
    }
  };
  const prisma = {
    paymentPromise: { findFirstOrThrow: async () => PROMISE },
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => {
      const result = await fn(tx);
      state.committed = true;
      return result;
    }
  };
  return { prisma, state };
}

function callerFor(prisma: unknown) {
  return appRouter.createCaller({
    token: "tkn",
    user: { ref: "u1", accessKeyId: "us_1" },
    workspace: { accessKeyId: "ws_1", role: "WORKSPACE_MEMBER" },
    prisma
  } as unknown as Context);
}

describe("campaigns.paymentPromise.resolve", () => {
  let listener: ((event: ContactLogChangeEvent) => void) | undefined;

  afterEach(() => {
    if (listener) contactLogEvents.off(CONTACT_LOG_CHANGED, listener);
    listener = undefined;
  });

  it("emits contactLogChanged for the promise's gestión after the transaction commits", async () => {
    // Arrange
    const { prisma, state } = makePrisma();
    const seen: { event: ContactLogChangeEvent; committed: boolean }[] = [];
    listener = (event) => seen.push({ event, committed: state.committed });
    contactLogEvents.on(CONTACT_LOG_CHANGED, listener);

    // Act
    const result = await callerFor(prisma).campaigns.paymentPromise.resolve({
      id: "pp-1",
      status: "CANCELLED"
    });

    // Assert
    assert.equal(result.status, "CANCELLED");
    assert.deepEqual(seen, [{ event: { id: "log-1", workspaceRef: "ws_1" }, committed: true }]);
  });
});
