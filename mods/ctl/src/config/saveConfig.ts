import fs from "node:fs";
import { BASE_DIR } from "../constants.js";
import type { WorkspaceConfig } from "./types.js";

/** Writes the full list of configured workspaces to `path`, creating the parent dir if needed. */
export function saveConfig(path: string, config: WorkspaceConfig[]): void {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
  fs.writeFileSync(path, JSON.stringify(config, null, 2));
}
