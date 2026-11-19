import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createListExits } from "./listExits.js";
import { readClient } from "../recovery/fakeDb.js";

const exit = (id: string, fields: Record<string, unknown> = {}) => ({
  id,
  portfolioId: "p1",
  portfolioAccountId: `acc-${id}`,
  portfolioAccount: {
    externalId: `C-${id}`,
    fullName: "María Rosario",
    portfolio: { workspaceRef: "ws" }
  },
  reason: "UNKNOWN",
  exitedAt: new Date("2026-11-12T12:00:00Z"),
  missedInstallments: 3,
  termsAmount: 2500,
  classifiedAt: null,
  reenteredAt: null,
  ...fields
});

describe("portfolios.listExits", () => {
  it("returns only open exits with the requested reason, with amountIfRecovered", async () => {
    const client = readClient({
      exits: [
        exit("e1"),
        exit("e2", { reason: "CAUGHT_UP", classifiedAt: new Date() }),
        exit("e3", { reenteredAt: new Date() }),
        exit("e4", { portfolioId: "p2" })
      ]
    });
    const result = await createListExits(
      client as never,
      "ws"
    )({ portfolioId: "p1", reason: "UNKNOWN" });
    assert.equal(result.total, 1);
    assert.deepEqual(result.items, [
      {
        id: "e1",
        externalId: "C-e1",
        fullName: "María Rosario",
        reason: "UNKNOWN",
        exitedAt: new Date("2026-11-12T12:00:00Z"),
        missedInstallments: 3,
        termsAmount: 2500,
        amountIfRecovered: 7500,
        classifiedAt: null
      }
    ]);
  });

  it("lists every open exit when no reason is given", async () => {
    const client = readClient({ exits: [exit("e1"), exit("e2", { reason: "WRITTEN_OFF" })] });
    const result = await createListExits(client as never, "ws")({ portfolioId: "p1" });
    assert.equal(result.total, 2);
  });
});
