import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  phone: z.string().max(20).optional()
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  password: z.string().min(8).max(128)
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
