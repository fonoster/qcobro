import {
  updateWorkspaceSettingsSchema,
  withErrorHandlingAndValidation,
  type UpdateWorkspaceSettingsInput,
  type WorkspaceSettingsClient,
  type WorkspaceSettingsRecord
} from "@qcobro/common";

/**
 * Update the active workspace's settings (currency + timezone). Upserts so a workspace
 * that has never had a settings row gets one. Invalid input (unsupported currency or
 * empty timezone) is rejected by validation before any write.
 */
export function createUpdateWorkspaceSettings(
  client: WorkspaceSettingsClient,
  workspaceRef: string
) {
  const fn = (input: UpdateWorkspaceSettingsInput): Promise<WorkspaceSettingsRecord> =>
    client.workspaceSettings.upsert({
      where: { workspaceRef },
      create: { workspaceRef, currency: input.currency, timezone: input.timezone },
      update: { currency: input.currency, timezone: input.timezone }
    });
  return withErrorHandlingAndValidation(fn, updateWorkspaceSettingsSchema);
}
