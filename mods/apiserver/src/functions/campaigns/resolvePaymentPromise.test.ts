import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createResolvePaymentPromise } from "./resolvePaymentPromise.js";

function makeClient(promise: Record<string, unknown> | null) {
  const cap: {
    portfolioUpdate?: Record<string, unknown>;
    promiseUpdate?: { id: string; data: Record<string, unknown> };
  } = {};
  const client = {
    paymentPromise: {
      findFirst: async () => promise as never,
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        cap.promiseUpdate = { id: args.where.id, data: args.data };
        return { id: args.where.id, ...args.data } as never;
      }
    },
    portfolioAccount: {
      findFirst: async () =>
        ({ id: "acc-1", portfolioId: "p-1", outstandingBalance: 1000 }) as never
    },
    portfolio: {
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        cap.portfolioUpdate = args.data;
        return { id: args.where.id } as never;
      }
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(client)
  };
  return { client, cap };
}

describe("resolvePaymentPromise", () => {
  it("marks a PENDING promise MET and credits recoveredAmount", async () => {
    const { client, cap } = makeClient({
      id: "pr-1",
      portfolioAccountId: "acc-1",
      amount: 500,
      status: "PENDING"
    });
    await createResolvePaymentPromise(client as never)({ id: "pr-1", status: "MET" });
    assert.equal(cap.promiseUpdate?.data.status, "MET");
    assert.deepEqual(cap.portfolioUpdate, { recoveredAmount: { increment: 500 } });
  });

  it("does not re-credit a promise that is already MET", async () => {
    const { client, cap } = makeClient({
      id: "pr-1",
      portfolioAccountId: "acc-1",
      amount: 500,
      status: "MET"
    });
    await createResolvePaymentPromise(client as never)({ id: "pr-1", status: "MET" });
    assert.equal(cap.portfolioUpdate, undefined, "no double credit");
  });

  it("cancels without crediting recoveredAmount", async () => {
    const { client, cap } = makeClient({
      id: "pr-1",
      portfolioAccountId: "acc-1",
      amount: 500,
      status: "PENDING"
    });
    await createResolvePaymentPromise(client as never)({ id: "pr-1", status: "CANCELLED" });
    assert.equal(cap.promiseUpdate?.data.status, "CANCELLED");
    assert.equal(cap.portfolioUpdate, undefined);
  });

  it("rejects an unsupported status with a ValidationError before any work", async () => {
    const { client, cap } = makeClient({ id: "pr-1", status: "PENDING", amount: 1 });
    await assert.rejects(
      // EXPIRED is system-only, not an operator action.
      () =>
        createResolvePaymentPromise(client as never)({ id: "pr-1", status: "EXPIRED" } as never),
      ValidationError
    );
    assert.equal(cap.promiseUpdate, undefined, "no mutation on invalid input");
  });
});
