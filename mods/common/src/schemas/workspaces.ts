import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(60)
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const getWorkspaceSchema = z.object({
  ref: z.string().min(1)
});
export type GetWorkspaceInput = z.infer<typeof getWorkspaceSchema>;

export const workspaceRoleEnum = z.enum(["WORKSPACE_ADMIN", "WORKSPACE_MEMBER"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleEnum>;

export const inviteMemberSchema = z.object({
  email: z.email(),
  role: workspaceRoleEnum.default("WORKSPACE_MEMBER"),
  name: z.string().max(60).optional()
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const removeMemberSchema = z.object({
  userRef: z.string().min(1)
});
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

export const resendInvitationSchema = z.object({
  userRef: z.string().min(1)
});
export type ResendInvitationInput = z.infer<typeof resendInvitationSchema>;
