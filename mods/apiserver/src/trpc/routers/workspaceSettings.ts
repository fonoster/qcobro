import { updateWorkspaceSettingsSchema } from "@qcobro/common";
import { router, workspaceProcedure } from "../trpc.js";
import { createUpdateWorkspaceSettings } from "../../functions/workspaceSettings/updateWorkspaceSettings.js";

/** Per-workspace settings (currency, timezone + number-formatting locale) for the active
 * workspace. `locale` is read-only here: it has no console control while a single locale is
 * supported, but the console still needs it so the reach-out preview formats amounts exactly
 * as a dispatch will. */
export const workspaceSettingsRouter = router({
  // The active workspace's settings are already resolved (and seeded) into the context.
  get: workspaceProcedure.query(({ ctx }) => ({
    currency: ctx.currency,
    timezone: ctx.timezone,
    locale: ctx.locale
  })),

  update: workspaceProcedure
    .input(updateWorkspaceSettingsSchema)
    .mutation(({ input, ctx }) =>
      createUpdateWorkspaceSettings(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    )
});
