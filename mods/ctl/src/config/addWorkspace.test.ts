import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createAddWorkspace } from "./addWorkspace.js";
import type { WorkspaceConfig } from "./types.js";

const VALID: WorkspaceConfig = {
  name: "acme",
  endpoint: "https://api.qcobro.com",
  workspaceAccessKeyId: "WO6ueex0qan9ojhf820wgiae3qi5luy08y",
  accessKeyId: "APvsqbjfxua7zvbupqvd8hfy72hix4b7mv",
  accessKeySecret: "s3cr3t"
};

describe("createAddWorkspace", () => {
  it("adds a new workspace as active when the list is empty", async () => {
    const addWorkspace = createAddWorkspace([]);
    const updated = await addWorkspace(VALID);

    assert.equal(updated.length, 1);
    assert.equal(updated[0].active, true);
    assert.equal(updated[0].workspaceAccessKeyId, VALID.workspaceAccessKeyId);
  });

  it("deactivates every other workspace when adding a new one", async () => {
    const existing: WorkspaceConfig = { ...VALID, workspaceAccessKeyId: "WOother", active: true };
    const addWorkspace = createAddWorkspace([existing]);
    const updated = await addWorkspace({ ...VALID, name: "second" });

    const first = updated.find((w) => w.workspaceAccessKeyId === "WOother");
    const second = updated.find((w) => w.workspaceAccessKeyId === VALID.workspaceAccessKeyId);
    assert.equal(first?.active, false);
    assert.equal(second?.active, true);
  });

  it("replaces (not duplicates) a workspace already in the list, by workspaceAccessKeyId", async () => {
    const existing: WorkspaceConfig = { ...VALID, name: "old-name", active: true };
    const addWorkspace = createAddWorkspace([existing]);
    const updated = await addWorkspace({ ...VALID, name: "new-name" });

    assert.equal(updated.length, 1);
    assert.equal(updated[0].name, "new-name");
    assert.equal(updated[0].active, true);
  });

  it("rejects a workspace missing a required field with a structured ValidationError, and never touches the list", async () => {
    const addWorkspace = createAddWorkspace([]);

    await assert.rejects(
      () => addWorkspace({ ...VALID, accessKeySecret: "" }),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.fieldErrors.some((f) => f.field === "accessKeySecret"));
        return true;
      }
    );
  });

  it("rejects an empty endpoint before adding the workspace", async () => {
    const addWorkspace = createAddWorkspace([]);

    await assert.rejects(() => addWorkspace({ ...VALID, endpoint: "" }), ValidationError);
  });
});
