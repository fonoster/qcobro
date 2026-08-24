import { PrismaClient } from "@prisma/client";
import { fieldEncryptionExtension } from "prisma-field-encryption";
import { config } from "./config.js";
import { withStatementTimeout } from "./dbConnectionUrl.js";
import { contactLogEventsExtension } from "./services/contactLogEvents.js";

const client = new PrismaClient({
  datasourceUrl: withStatementTimeout(config.database.url, config.database.statementTimeoutMs)
});

// Realtime-streaming capability: emits a change signal on every accountContactLog /
// paymentPromise write, covering every write path (manual create, engine dispatch, webhook
// ingestion, AI insight generation, payment-promise resolution) from one place. `client`
// (not the extended export below) is passed so the extension's own lookup query never
// re-enters itself.
const withContactLogEvents = client.$extends(contactLogEventsExtension(client));

/**
 * When a cloak key is configured, transparently encrypt/decrypt `/// @encrypted`
 * fields (the WhatsApp WABA `accessToken`) via `prisma-field-encryption` — the same
 * pattern Fonoster and Routr use. When the key is absent the plain client is used and
 * features that store tenant secrets (the Workspace Integrations area) stay disabled
 * rather than crashing boot. Only the key is global; the secret is per-workspace in the DB.
 */
const cloakKey = config.security?.cloakEncryptionKey;

// Fail fast with an actionable message when a key is set but malformed, rather than
// letting @47ng/cloak throw an opaque "Unknown key format" from deep in the extension
// at boot. A present-but-invalid key must not silently fall back to the plain client —
// that would write tenant secrets (WhatsApp WABA tokens) to the DB in plaintext.
if (cloakKey && !/^k1\.aesgcm256\.[A-Za-z0-9_-]+={0,2}$/.test(cloakKey)) {
  throw new Error(
    "security.cloakEncryptionKey is malformed. Expected a versioned cloak key of the form " +
      "`k1.aesgcm256.<base64-32-byte>` (generate one with `@47ng/cloak generate`). " +
      "Remove the key to disable Workspace Integrations, or fix its format."
  );
}

// Both extensions intercept queries transparently and do not change the client's public
// surface, so we expose the result as a plain PrismaClient for all consumers.
export const prisma: PrismaClient = (cloakKey
  ? withContactLogEvents.$extends(fieldEncryptionExtension({ encryptionKey: cloakKey }))
  : withContactLogEvents) as unknown as PrismaClient;
