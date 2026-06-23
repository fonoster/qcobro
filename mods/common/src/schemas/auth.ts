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

// Exchange a workspace API key (accessKeyId + accessKeySecret) for tokens.
// Used by unattended, server-to-server integrations (e.g. the SDK's
// loginWithApiKey) that cannot perform an interactive credentials login.
export const apiKeyLoginSchema = z.object({
  accessKeyId: z.string().min(1),
  accessKeySecret: z.string().min(1)
});
export type ApiKeyLoginInput = z.infer<typeof apiKeyLoginSchema>;

export const sendResetPasswordCodeSchema = z.object({
  username: z.email(),
  resetPasswordUrl: z.string().url()
});
export type SendResetPasswordCodeInput = z.infer<typeof sendResetPasswordCodeSchema>;

export const resetPasswordSchema = z.object({
  username: z.email(),
  password: z.string().min(8).max(128),
  verificationCode: z.string().min(1)
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const contactTypeEnum = z.enum(["EMAIL", "PHONE"]);
export type ContactType = z.infer<typeof contactTypeEnum>;

export const sendVerificationCodeSchema = z.object({
  contactType: contactTypeEnum,
  value: z.string().min(1)
});
export type SendVerificationCodeInput = z.infer<typeof sendVerificationCodeSchema>;

export const verifyCodeSchema = z.object({
  username: z.email(),
  contactType: contactTypeEnum,
  value: z.string().min(1),
  verificationCode: z.string().min(1)
});
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;

// Identity currently supports a single OAuth2 provider.
export const oauthProviderEnum = z.enum(["GITHUB"]);
export type OauthProvider = z.infer<typeof oauthProviderEnum>;

export const oauthSignInSchema = z.object({
  provider: oauthProviderEnum,
  code: z.string().min(1)
});
export type OauthSignInInput = z.infer<typeof oauthSignInSchema>;

export const oauthSignUpSchema = z.object({
  code: z.string().min(1)
});
export type OauthSignUpInput = z.infer<typeof oauthSignUpSchema>;
