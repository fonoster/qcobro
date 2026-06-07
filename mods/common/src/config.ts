import { z } from "zod";

/**
 * QCobro service configuration — the shape of `qcobro.json`.
 *
 * This module exports the schema/type only (no filesystem access) so it stays
 * safe to import from the browser. Server packages load the file and call
 * `qcobroConfigSchema.parse(...)`.
 */
export const smtpConfigSchema = z.object({
  host: z.string().default("localhost"),
  port: z.number().default(1025),
  secure: z.boolean().default(false),
  sender: z.string().default("QCobro <no-reply@qcobro.local>"),
  auth: z
    .object({
      user: z.string().default(""),
      pass: z.string().default("")
    })
    .default({ user: "", pass: "" })
});

export const identityConfigSchema = z.object({
  /** PostgreSQL connection for the Identity service's own database. */
  databaseUrl: z.string().min(1),
  /** prisma-field-encryption (cloak) key, e.g. "k1.aesgcm256.<base64>". */
  encryptionKey: z.string().min(1),
  /** RS256 key pair used to sign/verify JWTs. */
  privateKeyPath: z.string().min(1),
  publicKeyPath: z.string().min(1),
  issuer: z.string().default("qcobro"),
  audience: z.string().default("qcobro"),
  accessTokenExpiresIn: z.string().default("12h"),
  refreshTokenExpiresIn: z.string().default("30d"),
  idTokenExpiresIn: z.string().default("12h"),
  /** Port the Identity gRPC service listens on. */
  port: z.number().default(50051),
  /** host:port the apiserver uses to reach Identity. */
  endpoint: z.string().default("localhost:50051"),
  contactVerificationRequired: z.boolean().default(false),
  twoFactorAuthenticationRequired: z.boolean().default(false),
  workspaceInviteUrl: z.string().default("http://localhost:5173/accept-invite"),
  workspaceInviteFailUrl: z.string().default("http://localhost:5173/invite-failed"),
  workspaceInviteExpiration: z.string().default("1d"),
  smtp: smtpConfigSchema.default({
    host: "localhost",
    port: 1025,
    secure: false,
    sender: "QCobro <no-reply@qcobro.local>",
    auth: { user: "", pass: "" }
  })
});

export const qcobroConfigSchema = z.object({
  /** Application (apiserver) database. */
  database: z.object({ url: z.string().min(1) }),
  identity: identityConfigSchema,
  apiserver: z.object({ port: z.number().default(3000) }).default({ port: 3000 })
});

export type SmtpConfig = z.infer<typeof smtpConfigSchema>;
export type IdentityConfig = z.infer<typeof identityConfigSchema>;
export type QCobroConfig = z.infer<typeof qcobroConfigSchema>;
