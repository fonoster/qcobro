#!/usr/bin/env node
// Writes the development config in .dev/ (git-ignored) for the dev container's stack. Each file
// is written only when it is missing, so running it again changes nothing; to regenerate, delete
// .dev/ and open the container again.
//
//   .dev/identity/keys/{private,public}.pem   Identity's signing keys
//   .dev/identity/identity.json                Identity's config (postgres, mailpit)
//   .dev/tls/{ca.pem,server.pem,server-key.pem} the fake Fonoster's certificate (SAN
//                                              fonoster-fake, localhost) and the CA the
//                                              apiserver trusts it by (FONOSTER_CA_FILE)
//   .dev/qcobro.json                           the apiserver's config, derived from
//                                              config/qcobro.example.json, never from
//                                              config/qcobro.json
//   .dev/fonoster-fake.env                     the fake's environment, from .dev/qcobro.json
//
// It reads the fake's secrets from .dev/.env (.devcontainer/initialize.sh writes it first) and
// needs Node and openssl; initialize.sh runs it in the workspace image. Run from the repository
// root: `node scripts/dev-config.mjs`.
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEV = join(ROOT, ".dev");

// The fake's fixed credentials (a workspace and an API key in Fonoster's format) and the
// number it lets calls be placed from.
const FAKE_ACCESS_KEY_ID = "WO00000000000000000000000000000001";
const FAKE_API_KEY = "AP00000000000000000000000000000001";
const FAKE_NUMBERS = ["+18095550000"];

function log(message) {
  process.stderr.write(`[dev-config] ${message}\n`);
}

/** Writes `path` with what `content()` returns, unless it already exists. */
function writeMissing(path, content) {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content());
  log(`wrote ${path.slice(ROOT.length + 1)}`);
}

function readDevEnv() {
  const path = join(DEV, ".env");
  if (!existsSync(path)) {
    throw new Error(`${path} is missing: run .devcontainer/initialize.sh first`);
  }
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  for (const name of ["FONOSTER_FAKE_API_SECRET", "FONOSTER_FAKE_WEBHOOK_SECRET"]) {
    if (!env[name]) throw new Error(`${name} is missing from ${path}`);
  }
  return env;
}

/** A cloak (prisma-field-encryption) key: 32 random bytes, base64url. */
function cloakKey() {
  return `k1.aesgcm256.${randomBytes(32).toString("base64url")}`;
}

function writeIdentity() {
  const keys = join(DEV, "identity", "keys");
  if (!existsSync(join(keys, "private.pem")) || !existsSync(join(keys, "public.pem"))) {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    rmSync(join(keys, "private.pem"), { force: true });
    rmSync(join(keys, "public.pem"), { force: true });
    writeMissing(join(keys, "private.pem"), () => privateKey);
    writeMissing(join(keys, "public.pem"), () => publicKey);
  }

  writeMissing(
    join(DEV, "identity", "identity.json"),
    () =>
      JSON.stringify(
        {
          server: { bindAddr: "0.0.0.0:50051", httpBridgePort: 9110 },
          database: { url: "postgresql://qcobro:qcobro@postgres:5432/identity?schema=public" },
          encryptionKey: cloakKey(),
          issuer: "qcobro",
          audience: "qcobro",
          keys: {
            privateKeyPath: "/service/config/keys/private.pem",
            publicKeyPath: "/service/config/keys/public.pem"
          },
          appUrl: "http://localhost:5173",
          invite: {
            url: "http://localhost:5173/accept-invite",
            failUrl: "http://localhost:5173/invite-failed"
          },
          smtp: {
            host: "mailpit",
            port: 1025,
            secure: false,
            sender: "QCobro <no-reply@qcobro.local>"
          }
        },
        null,
        2
      ) + "\n"
  );
}

function writeTls() {
  const tls = join(DEV, "tls");
  const files = ["ca.pem", "server.pem", "server-key.pem"].map((name) => join(tls, name));
  if (files.every((file) => existsSync(file))) return;

  // All three together: a new server certificate needs the CA's key, which is not kept.
  const work = mkdtempSync(join(tmpdir(), "qcobro-tls-"));
  const openssl = (...args) => execFileSync("openssl", args, { cwd: work, stdio: "pipe" });
  try {
    openssl(
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "3650",
      "-subj",
      "/CN=QCobro dev fonoster-fake CA",
      "-keyout",
      "ca-key.pem",
      "-out",
      "ca.pem"
    );
    openssl(
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-subj",
      "/CN=fonoster-fake",
      "-keyout",
      "server-key.pem",
      "-out",
      "server.csr"
    );
    writeFileSync(join(work, "san.ext"), "subjectAltName=DNS:fonoster-fake,DNS:localhost\n");
    openssl(
      "x509",
      "-req",
      "-in",
      "server.csr",
      "-CA",
      "ca.pem",
      "-CAkey",
      "ca-key.pem",
      "-CAcreateserial",
      "-days",
      "3650",
      "-extfile",
      "san.ext",
      "-out",
      "server.pem"
    );
    for (const file of files) rmSync(file, { force: true });
    for (const file of files) {
      writeMissing(file, () => readFileSync(join(work, file.slice(tls.length + 1))));
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function writeQcobroJson(env) {
  const path = join(DEV, "qcobro.json");
  writeMissing(path, () => {
    const example = JSON.parse(readFileSync(join(ROOT, "config", "qcobro.example.json"), "utf8"));
    const config = { ...example };
    config.database = { url: "postgresql://qcobro:qcobro@postgres:5432/qcobro?schema=public" };
    config.identity = { endpoint: "identity:50051", httpBridgeUrl: "http://identity:9110" };
    config.ai = { enabled: true, provider: "mock", model: "mock" };
    config.security = { cloakEncryptionKey: cloakKey() };
    config.fonoster = {
      accessKeyId: FAKE_ACCESS_KEY_ID,
      apiKey: FAKE_API_KEY,
      apiSecret: env.FONOSTER_FAKE_API_SECRET,
      endpoint: "fonoster-fake:50052",
      webhookSecret: env.FONOSTER_FAKE_WEBHOOK_SECRET,
      numbers: FAKE_NUMBERS,
      autopilot: example.fonoster.autopilot,
      voices: example.fonoster.voices
    };
    // No SMS or email providers (their SDKs check the placeholder credentials at startup), no
    // contact-log auth, and the engine off: it never dials or sends in development.
    delete config.twilio;
    delete config.resend;
    delete config.engine;
    if (config.apiserver) {
      config.apiserver = { ...config.apiserver };
      delete config.apiserver.contactLogAuth;
    }
    return JSON.stringify(config, null, 2) + "\n";
  });
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeFakeEnv(config) {
  const { fonoster } = config;
  const autopilot = fonoster.autopilot ?? {};
  const model = `${autopilot.llmProvider ?? "google"}/${autopilot.llmModel ?? "gemini-3.1-flash-lite"}`;
  writeMissing(join(DEV, "fonoster-fake.env"), () =>
    [
      `FONOSTER_FAKE_ACCESS_KEY_ID=${fonoster.accessKeyId}`,
      `FONOSTER_FAKE_API_KEY=${fonoster.apiKey}`,
      `FONOSTER_FAKE_API_SECRET=${fonoster.apiSecret}`,
      `FONOSTER_FAKE_WEBHOOK_SECRET=${fonoster.webhookSecret}`,
      `FONOSTER_FAKE_NUMBERS=${fonoster.numbers.join(",")}`,
      `FONOSTER_FAKE_LLM_MODELS=${model}`,
      ""
    ].join("\n")
  );
}

const env = readDevEnv();
writeIdentity();
writeTls();
writeFakeEnv(writeQcobroJson(env));
