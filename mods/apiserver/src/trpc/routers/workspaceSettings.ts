import { updateWorkspaceSettingsSchema } from "@qcobro/common";
import { router, workspaceProcedure } from "../trpc.js";
import { createUpdateWorkspaceSettings } from "../../functions/workspaceSettings/updateWorkspaceSettings.js";

/** Per-workspace settings (currency + timezone) for the active workspace. */
export const workspaceSettingsRouter = router({
  // The active workspace's settings are already resolved (and seeded) into the context.
  get: workspaceProcedure.query(({ ctx }) => ({
    currency: ctx.currency,
    timezone: ctx.timezone
  })),

  update: workspaceProcedure
    .input(updateWorkspaceSettingsSchema)
    .mutation(({ input, ctx }) =>
      createUpdateWorkspaceSettings(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    )
});
