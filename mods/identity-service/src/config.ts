import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { qcobroConfigSchema } from "@qcobro/common";

/**
 * Loads service configuration from `qcobro.json` (Zod-validated via
 * @qcobro/common) instead of environment variables. The file path comes from
 * QCOBRO_CONFIG, defaulting to the repo-root qcobro.json relative to this
 * package's working directory.
 */
const configPath = process.env.QCOBRO_CONFIG ?? resolve(process.cwd(), "../../qcobro.json");
const config = qcobroConfigSchema.parse(JSON.parse(readFileSync(configPath, "utf8")));

const id = config.identity;

export const identityPort = id.port;

/** Configuration object in the shape Fonoster Identity's buildIdentityService expects. */
export const identityConfig = {
  dbUrl: id.databaseUrl,
  issuer: id.issuer,
  audience: id.audience,
  privateKey: readFileSync(resolve(process.cwd(), id.privateKeyPath), "utf8"),
  publicKey: readFileSync(resolve(process.cwd(), id.publicKeyPath), "utf8"),
  encryptionKey: id.encryptionKey,
  accessTokenExpiresIn: id.accessTokenExpiresIn,
  refreshTokenExpiresIn: id.refreshTokenExpiresIn,
  idTokenExpiresIn: id.idTokenExpiresIn,
  workspaceInviteExpiration: id.workspaceInviteExpiration,
  workspaceInviteUrl: id.workspaceInviteUrl,
  workspaceInviteFailUrl: id.workspaceInviteFailUrl,
  contactVerificationRequired: id.contactVerificationRequired,
  twoFactorAuthenticationRequired: id.twoFactorAuthenticationRequired,
  smtpConfig: {
    host: id.smtp.host,
    port: id.smtp.port,
    secure: id.smtp.secure,
    sender: id.smtp.sender,
    auth: {
      user: id.smtp.auth.user,
      pass: id.smtp.auth.pass
    }
  }
};
