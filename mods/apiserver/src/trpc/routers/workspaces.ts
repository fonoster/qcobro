import { createWorkspaceSchema, getWorkspaceSchema } from "@qcobro/common";
import { router, protectedProcedure } from "../trpc.js";
import { identityCall } from "../../identity/errors.js";

export const workspacesRouter = router({
  // Any authenticated user can create a workspace and becomes its owner.
  create: protectedProcedure
    .input(createWorkspaceSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() => ctx.identity.createWorkspace(input.name, ctx.token))
    ),

  // Workspaces the caller owns or is an active member of.
  list: protectedProcedure.query(({ ctx }) =>
    identityCall(() => ctx.identity.listWorkspaces(ctx.token))
  ),

  get: protectedProcedure
    .input(getWorkspaceSchema)
    .query(({ ctx, input }) => identityCall(() => ctx.identity.getWorkspace(input.ref, ctx.token)))
});
