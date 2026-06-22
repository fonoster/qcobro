import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDeleteCampaign } from "./deleteCampaign.js";
import { ValidationError } from "@qcobro/common";

function makeClient(attempts: number) {
  let deleted = false;
  const client = {
    campaign: {
      findFirstOrThrow: async () =>
        ({ id: "camp-1", workspaceRef: "ws-1", status: "PAUSED" }) as never,
      delete: async () => {
        deleted = true;
        return { id: "camp-1" } as never;
      }
    },
    campaignAccountState: {
      count: async () => attempts
    }
  };
  return { client, wasDeleted: () => deleted };
}

describe("deleteCampaign", () => {
  it("deletes a campaign with no recorded attempts", async () => {
    const { client, wasDeleted } = makeClient(0);
    const fn = createDeleteCampaign(client as never, "ws-1");

    await fn({ id: "camp-1" });

    assert.equal(wasDeleted(), true);
  });

  it("refuses to delete a campaign with recorded attempts", async () => {
    const { client, wasDeleted } = makeClient(3);
    const fn = createDeleteCampaign(client as never, "ws-1");

    await assert.rejects(() => fn({ id: "camp-1" }), ValidationError);
    assert.equal(wasDeleted(), false);
  });
});
