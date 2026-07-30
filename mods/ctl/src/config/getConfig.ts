import fs from "node:fs";
import type { WorkspaceConfig } from "./types.js";

/** Reads the list of configured workspaces from `path`. Returns `[]` if the file doesn't exist. */
export function getConfig(path: string): WorkspaceConfig[] {
  if (!fs.existsSync(path)) {
    return [];
  }

  const data = fs.readFileSync(path, "utf8");
  return JSON.parse(data) as WorkspaceConfig[];
}
