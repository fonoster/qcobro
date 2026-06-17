import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  phone: z.string().max(20).optional()
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
