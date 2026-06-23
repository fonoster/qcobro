import {
  createWorkspaceSchema,
  getWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  removeMemberSchema,
  resendInvitationSchema,
  deleteWorkspaceSchema,
  acceptInvitationSchema
} from "@qcobro/common";
import {
  router,
  publicProcedure,
  protectedProcedure,
  workspaceProcedure,
  adminProcedure,
  ownerProcedure
} from "../trpc.js";
import { identityCall } from "../identityCall.js";
import { config } from "../../config.js";
import { TRPCError } from "@trpc/server";

export const workspacesRouter = router({
  // Accept a workspace invitation by forwarding the signed token to the
  // Identity HTTP bridge, which marks the membership ACTIVE. The bridge always
  // responds with a 302 — to appUrl on success, to failUrl on failure — so we
  // distinguish the two by checking the Location header.
  acceptInvitation: publicProcedure.input(acceptInvitationSchema).mutation(async ({ input }) => {
    const url = `${config.identity.httpBridgeUrl}/api/identity/accept-invite?token=${encodeURIComponent(input.token)}`;
    const res = await fetch(url, { redirect: "manual" });
    if (res.status !== 302) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Identity bridge error" });
    }
    const location = res.headers.get("location") ?? "";
    if (location.includes("invite-failed")) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired invitation token" });
    }
    return { success: true };
  }),

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

  // Each workspace enriched with its cartera + member counts, for the workspace
  // picker. protectedProcedure (no active workspace required): counts are gathered
  // per workspace from Prisma (portfolios) and Identity (members). The owner is not a
  // member row in Identity (mirrors the Members page), so it's added to the count. A
  // failed member lookup degrades that workspace to the owner-only count of 1.
  summaries: protectedProcedure.query(async ({ ctx }) => {
    const { items } = await identityCall(() => ctx.identity.listWorkspaces(ctx.token));
    return Promise.all(
      items.map(async (ws) => {
        const [portfolioCount, memberCount] = await Promise.all([
          ctx.prisma.portfolio.count({
            where: { workspaceRef: ws.accessKeyId, archivedAt: null }
          }),
          ctx.identity
            .listWorkspaceMembers(ws.accessKeyId, ctx.token)
            .then((m) => m.items.length + 1)
            .catch(() => 1)
        ]);
        return {
          ref: ws.ref,
          name: ws.name,
          accessKeyId: ws.accessKeyId,
          portfolioCount,
          memberCount
        };
      })
    );
  }),

  get: protectedProcedure
    .input(getWorkspaceSchema)
    .query(({ ctx, input }) => identityCall(() => ctx.identity.getWorkspace(input.ref, ctx.token))),

  // Rename the active workspace (owners/admins only).
  update: adminProcedure
    .input(updateWorkspaceSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() => ctx.identity.updateWorkspace(input.ref, input.name, ctx.token))
    ),

  // Permanently delete a workspace (owner only). Irreversible.
  delete: ownerProcedure
    .input(deleteWorkspaceSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() => ctx.identity.deleteWorkspace(input.ref, ctx.token))
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
