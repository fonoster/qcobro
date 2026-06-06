import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(60)
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const getWorkspaceSchema = z.object({
  ref: z.string().min(1)
});
export type GetWorkspaceInput = z.infer<typeof getWorkspaceSchema>;
