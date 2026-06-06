import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().min(1).max(60),
  email: z.email(),
  password: z.string().min(8).max(128),
  phone: z.string().max(20).optional(),
  avatar: z.string().max(255).optional()
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  twoFactorCode: z.string().optional()
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
