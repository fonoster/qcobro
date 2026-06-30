import { PrismaClient } from "@prisma/client";
import { fieldEncryptionExtension } from "prisma-field-encryption";
import { config } from "./config.js";

const client = new PrismaClient({ datasourceUrl: config.database.url });

/**
 * When a cloak key is configured, transparently encrypt/decrypt `/// @encrypted`
 * fields (the WhatsApp WABA `accessToken`) via `prisma-field-encryption` — the same
 * pattern Fonoster and Routr use. When the key is absent the plain client is used and
 * features that store tenant secrets (the Workspace Integrations area) stay disabled
 * rather than crashing boot. Only the key is global; the secret is per-workspace in the DB.
 */
const cloakKey = config.security?.cloakEncryptionKey;

// The encryption extension intercepts queries transparently and does not change the
// client's public surface, so we expose it as a plain PrismaClient for all consumers.
export const prisma: PrismaClient = (cloakKey
  ? client.$extends(fieldEncryptionExtension({ encryptionKey: cloakKey }))
  : client) as unknown as PrismaClient;
