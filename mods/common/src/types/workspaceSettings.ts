import type { Currency } from "../schemas/workspaceSettings.js";

export interface WorkspaceSettingsRecord {
  workspaceRef: string;
  currency: Currency;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

/** The DB surface the workspace-settings functions need (tests inject a stub). */
export interface WorkspaceSettingsClient {
  workspaceSettings: {
    findUnique(args: { where: { workspaceRef: string } }): Promise<WorkspaceSettingsRecord | null>;

    upsert(args: {
      where: { workspaceRef: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<WorkspaceSettingsRecord>;
  };
}
