import {
  createWorkspaceSchema,
  getWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  removeMemberSchema,
  resendInvitationSchema
} from "@qcobro/common";
import { router, protectedProcedure, workspaceProcedure, adminProcedure } from "../trpc.js";
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
    .query(({ ctx, input }) => identityCall(() => ctx.identity.getWorkspace(input.ref, ctx.token))),

  // Rename the active workspace (owners/admins only).
  update: adminProcedure
    .input(updateWorkspaceSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() => ctx.identity.updateWorkspace(input.ref, input.name, ctx.token))
    ),

  // Members of the active workspace.
  listMembers: workspaceProcedure.query(({ ctx }) =>
    identityCall(() => ctx.identity.listWorkspaceMembers(ctx.workspace.accessKeyId, ctx.token))
  ),

  // Invite a member (owners/admins only).
  invite: adminProcedure
    .input(inviteMemberSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() =>
        ctx.identity.inviteUserToWorkspace(
          { email: input.email, role: input.role, name: input.name },
          ctx.workspace.accessKeyId,
          ctx.token
        )
      )
    ),

  // Resend a pending invitation email (owners/admins only).
  resendInvitation: adminProcedure
    .input(resendInvitationSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() =>
        ctx.identity.resendWorkspaceMembershipInvitation(
          input.userRef,
          ctx.workspace.accessKeyId,
          ctx.token
        )
      )
    ),

  // Remove a member (owners/admins only).
  removeMember: adminProcedure
    .input(removeMemberSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() =>
        ctx.identity.removeUserFromWorkspace(input.userRef, ctx.workspace.accessKeyId, ctx.token)
      )
    )
});
