import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRecoveryList } from "./list.js";
import { readClient, recovery } from "./fakeDb.js";

const OCT = { from: "2026-10-01", to: "2026-10-31" };

describe("recovery.list", () => {
  it("lists the period's recoveries newest first with the account's id and name", async () => {
    const older = recovery({ detectedAt: new Date("2026-10-05T12:00:00Z") });
    const newer = recovery({ detectedAt: new Date("2026-10-20T12:00:00Z") });
    const client = readClient({
      recoveries: [older, newer, recovery({ detectedAt: new Date("2026-09-01T12:00:00Z") })]
    });
    const result = await createRecoveryList(client as never, "ws")(OCT);
    assert.equal(result.total, 2);
    assert.deepEqual(
      result.items.map((i) => i.id),
      [newer.id, older.id]
    );
    assert.equal(result.items[0]!.externalId, `C-${newer.id}`);
    assert.equal(result.items[0]!.fullName, "Ana Pérez");
    assert.ok(!("portfolioAccount" in result.items[0]!));
  });

  it("filters by kind and gestión, and pages", async () => {
    const client = readClient({
      recoveries: [
        recovery({ kind: "PARTIAL" }),
        recovery({ kind: "PARTIAL", hasGestion: false }),
        recovery({ kind: "CAUGHT_UP" })
      ]
    });
    const partial = await createRecoveryList(
      client as never,
      "ws"
    )({ ...OCT, kind: "PARTIAL", hasGestion: true });
    assert.equal(partial.total, 1);
    const page = await createRecoveryList(client as never, "ws")({ ...OCT, limit: 1, offset: 1 });
    assert.equal(page.items.length, 1);
    assert.equal(page.total, 3);
  });
});
