import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getActiveWorkspace } from "./getActiveWorkspace.js";
import { setActiveWorkspace } from "./setActiveWorkspace.js";
import { removeWorkspace } from "./removeWorkspace.js";
import type { WorkspaceConfig } from "./types.js";

function ws(overrides: Partial<WorkspaceConfig>): WorkspaceConfig {
  return {
    name: "acme",
    endpoint: "https://api.qcobro.com",
    workspaceAccessKeyId: "WOaaa",
    accessKeyId: "APaaa",
    accessKeySecret: "s3cr3t",
    ...overrides
  };
}

describe("getActiveWorkspace", () => {
  it("returns the workspace flagged active", () => {
    const workspaces = [
      ws({ workspaceAccessKeyId: "WOaaa", active: false }),
      ws({ workspaceAccessKeyId: "WObbb", active: true })
    ];
    assert.equal(getActiveWorkspace(workspaces)?.workspaceAccessKeyId, "WObbb");
  });

  it("returns undefined when no workspace is active", () => {
    const workspaces = [ws({ active: false })];
    assert.equal(getActiveWorkspace(workspaces), undefined);
  });
});

describe("setActiveWorkspace", () => {
  it("activates the named workspace and deactivates the rest", () => {
    const workspaces = [
      ws({ workspaceAccessKeyId: "WOaaa", active: true }),
      ws({ workspaceAccessKeyId: "WObbb", active: false })
    ];
    const updated = setActiveWorkspace("WObbb", workspaces);
    assert.equal(updated.find((w) => w.workspaceAccessKeyId === "WOaaa")?.active, false);
    assert.equal(updated.find((w) => w.workspaceAccessKeyId === "WObbb")?.active, true);
  });
});

describe("removeWorkspace", () => {
  it("removes the workspace with the matching workspaceAccessKeyId", () => {
    const workspaces = [
      ws({ workspaceAccessKeyId: "WOaaa" }),
      ws({ workspaceAccessKeyId: "WObbb" })
    ];
    const updated = removeWorkspace("WOaaa", workspaces);
    assert.equal(updated.length, 1);
    assert.equal(updated[0].workspaceAccessKeyId, "WObbb");
  });
});
