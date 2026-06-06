import { readFileSync } from "node:fs";

function readKey(path: string): string {
  return readFileSync(path, "utf8");
}

const env = process.env;

/**
 * Configuration for the Fonoster Identity service.
 *
 * Mirrors the upstream `IdentityConfig` shape. Secrets (RS256 key pair,
 * field-encryption key) come from files/env and are never committed. The running
 * service uses the Prisma client bundled in @fonoster/identity against `dbUrl`.
 */
export const identityConfig = {
  dbUrl:
    env.IDENTITY_DATABASE_URL ?? "postgresql://qcobro:qcobro@localhost:5432/identity?schema=public",
  issuer: env.IDENTITY_ISSUER ?? "qcobro",
  audience: env.IDENTITY_AUDIENCE ?? "qcobro",
  privateKey: readKey(env.IDENTITY_PRIVATE_KEY_PATH ?? "./keys/private.pem"),
  publicKey: readKey(env.IDENTITY_PUBLIC_KEY_PATH ?? "./keys/public.pem"),
  encryptionKey: env.IDENTITY_ENCRYPTION_KEY ?? "",
  accessTokenExpiresIn: env.IDENTITY_ACCESS_TOKEN_EXPIRES_IN ?? "15m",
  refreshTokenExpiresIn: env.IDENTITY_REFRESH_TOKEN_EXPIRES_IN ?? "24h",
  idTokenExpiresIn: env.IDENTITY_ID_TOKEN_EXPIRES_IN ?? "15m",
  workspaceInviteExpiration: env.IDENTITY_WORKSPACE_INVITE_EXPIRATION ?? "1d",
  workspaceInviteUrl: env.IDENTITY_WORKSPACE_INVITE_URL ?? "http://localhost:5173/accept-invite",
  workspaceInviteFailUrl:
    env.IDENTITY_WORKSPACE_INVITE_FAIL_URL ?? "http://localhost:5173/invite-failed",
  contactVerificationRequired: (env.IDENTITY_CONTACT_VERIFICATION_REQUIRED ?? "false") === "true",
  twoFactorAuthenticationRequired:
    (env.IDENTITY_TWO_FACTOR_AUTHENTICATION_REQUIRED ?? "false") === "true",
  smtpConfig: {
    host: env.SMTP_HOST ?? "localhost",
    port: Number(env.SMTP_PORT ?? 1025),
    secure: (env.SMTP_SECURE ?? "false") === "true",
    sender: env.SMTP_SENDER ?? "QCobro <no-reply@qcobro.local>",
    auth: {
      user: env.SMTP_AUTH_USER ?? "",
      pass: env.SMTP_AUTH_PASS ?? ""
    }
  }
};
