import { z } from "zod";
import { currencySchema } from "./workspaceSettings.js";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(60),
  currency: currencySchema,
  timezone: z.string().min(1)
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const getWorkspaceSchema = z.object({
  ref: z.string().min(1)
});
export type GetWorkspaceInput = z.infer<typeof getWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  ref: z.string().min(1),
  name: z.string().min(1).max(60)
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const deleteWorkspaceSchema = z.object({
  ref: z.string().min(1)
});
export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceSchema>;

export const workspaceRoleEnum = z.enum(["WORKSPACE_ADMIN", "WORKSPACE_MEMBER"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleEnum>;

export const inviteMemberSchema = z.object({
  email: z.email(),
  role: workspaceRoleEnum.default("WORKSPACE_MEMBER"),
  // Identity's inviteUserToWorkspace requires a name; keep the apiserver
  // contract in sync so a missing name fails validation with a clear message
  // instead of an opaque gRPC error.
  name: z.string().min(1).max(60)
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

export const acceptInvitationSchema = z.object({
  token: z.string().min(1)
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
