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
  it("rejects MET with a ValidationError, no mutation", async () => {
    const { client, cap } = makeClient({
      id: "pr-1",
      portfolioAccountId: "acc-1",
      amount: 500,
      status: "PENDING"
    });
    await assert.rejects(
      // A promise becomes MET only when a sync closes the account's episode.
      () => createResolvePaymentPromise(client as never)({ id: "pr-1", status: "MET" } as never),
      ValidationError
    );
    assert.equal(cap.promiseUpdate, undefined, "the promise is not changed");
    assert.equal(cap.portfolioUpdate, undefined, "no portfolio is updated");
  });

  it("cancels a PENDING promise without updating any portfolio", async () => {
    const { client, cap } = makeClient({
      id: "pr-1",
      portfolioAccountId: "acc-1",
      amount: 500,
      status: "PENDING"
    });
    await createResolvePaymentPromise(client as never)({ id: "pr-1", status: "CANCELLED" });
    assert.equal(cap.promiseUpdate?.data.status, "CANCELLED");
    assert.equal(cap.portfolioUpdate, undefined, "no portfolio is updated");
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
