import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRecoverySummary } from "./summary.js";
import { readClient, recovery } from "./fakeDb.js";

const OCT = { from: "2026-10-01", to: "2026-10-31" };

describe("recovery.summary", () => {
  it("splits recoveries in the period by gestión and ignores those outside it", async () => {
    const client = readClient({
      recoveries: [
        recovery({ amount: 3000 }),
        recovery({ amount: 1500 }),
        recovery({ amount: 800, hasGestion: false }),
        recovery({ amount: 9999, detectedAt: new Date("2026-09-20T12:00:00Z") }),
        recovery({ amount: 9999, portfolio: { workspaceRef: "other-ws" } })
      ],
      exits: [
        {
          portfolioId: "p1",
          reason: "UNKNOWN",
          reenteredAt: null,
          exitedAt: new Date(),
          portfolioAccount: { portfolio: { workspaceRef: "ws" } }
        },
        {
          portfolioId: "p1",
          reason: "CAUGHT_UP",
          reenteredAt: null,
          exitedAt: new Date(),
          portfolioAccount: { portfolio: { workspaceRef: "ws" } }
        },
        {
          portfolioId: "p1",
          reason: "UNKNOWN",
          reenteredAt: new Date(),
          exitedAt: new Date(),
          portfolioAccount: { portfolio: { workspaceRef: "ws" } }
        }
      ]
    });
    const result = await createRecoverySummary(client as never, "ws")(OCT);
    assert.deepEqual(result, {
      recovered: 4500,
      count: 2,
      withoutGestion: 800,
      withoutGestionCount: 1,
      pendingExits: 1,
      currency: "DOP"
    });
  });

  it("returns zeros for an empty period", async () => {
    const result = await createRecoverySummary(readClient({}) as never, "ws")(OCT);
    assert.deepEqual(result, {
      recovered: 0,
      count: 0,
      withoutGestion: 0,
      withoutGestionCount: 0,
      pendingExits: 0,
      currency: "DOP"
    });
  });

  it("puts 23:30 on Oct 31 in Santo Domingo inside October, not November", async () => {
    // 2026-10-31T23:30 America/Santo_Domingo (UTC-4) is 2026-11-01T03:30Z.
    const client = readClient({
      recoveries: [recovery({ amount: 700, detectedAt: new Date("2026-11-01T03:30:00Z") })]
    });
    const october = await createRecoverySummary(client as never, "ws")(OCT);
    const november = await createRecoverySummary(
      client as never,
      "ws"
    )({
      from: "2026-11-01",
      to: "2026-11-30"
    });
    assert.equal(october.recovered, 700);
    assert.equal(november.recovered, 0);
  });

  it("filters by portfolio", async () => {
    const client = readClient({
      recoveries: [recovery({ amount: 100 }), recovery({ amount: 200, portfolioId: "p2" })]
    });
    const result = await createRecoverySummary(
      client as never,
      "ws"
    )({ ...OCT, portfolioId: "p2" });
    assert.equal(result.recovered, 200);
  });
});
