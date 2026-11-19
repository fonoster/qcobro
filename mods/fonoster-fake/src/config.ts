import { z } from "zod";

/** The fake's settings, read from `FONOSTER_FAKE_*` environment variables (see the README). */
export interface FonosterFakeConfig {
  grpcPort: number;
  httpsPort: number;
  controlPort: number;
  tlsCert: string;
  tlsKey: string;
  accessKeyId: string;
  apiKey: string;
  apiSecret: string;
  numbers: string[];
  webhookUrl: string;
  webhookSecret: string;
  /** Unset: an unscripted or scripted call waits for `/_fake/calls/{ref}/complete`. */
  autoCompleteMs?: number;
  llmModels: string[];
}

const REQUIRED = [
  "FONOSTER_FAKE_GRPC_PORT",
  "FONOSTER_FAKE_HTTPS_PORT",
  "FONOSTER_FAKE_CONTROL_PORT",
  "FONOSTER_FAKE_TLS_CERT",
  "FONOSTER_FAKE_TLS_KEY",
  "FONOSTER_FAKE_ACCESS_KEY_ID",
  "FONOSTER_FAKE_API_KEY",
  "FONOSTER_FAKE_API_SECRET",
  "FONOSTER_FAKE_NUMBERS",
  "FONOSTER_FAKE_WEBHOOK_URL",
  "FONOSTER_FAKE_WEBHOOK_SECRET",
  "FONOSTER_FAKE_LLM_MODELS"
] as const;

const port = (name: string) =>
  z.coerce
    .number({ message: `${name} must be a port number` })
    .int({ message: `${name} must be a port number` })
    .min(0, { message: `${name} must be a port number` })
    .max(65535, { message: `${name} must be a port number` });

const list = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const envSchema = z.object({
  FONOSTER_FAKE_GRPC_PORT: port("FONOSTER_FAKE_GRPC_PORT"),
  FONOSTER_FAKE_HTTPS_PORT: port("FONOSTER_FAKE_HTTPS_PORT"),
  FONOSTER_FAKE_CONTROL_PORT: port("FONOSTER_FAKE_CONTROL_PORT"),
  FONOSTER_FAKE_WEBHOOK_URL: z.url({ message: "FONOSTER_FAKE_WEBHOOK_URL must be a URL" }),
  FONOSTER_FAKE_AUTO_COMPLETE_MS: z.coerce
    .number({ message: "FONOSTER_FAKE_AUTO_COMPLETE_MS must be milliseconds" })
    .int({ message: "FONOSTER_FAKE_AUTO_COMPLETE_MS must be milliseconds" })
    .nonnegative({ message: "FONOSTER_FAKE_AUTO_COMPLETE_MS must be milliseconds" })
    .optional()
});

/**
 * Reads the fake's configuration from the environment. Throws, naming the variable, when a
 * required one is missing or a value is malformed.
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env
): FonosterFakeConfig {
  const missing = REQUIRED.find((name) => !env[name]?.trim());
  if (missing) throw new Error(`Missing required environment variable: ${missing}`);

  const parsed = envSchema.safeParse({
    ...env,
    FONOSTER_FAKE_AUTO_COMPLETE_MS: env.FONOSTER_FAKE_AUTO_COMPLETE_MS?.trim() || undefined
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join("; "));

  const value = (name: (typeof REQUIRED)[number]) => (env[name] as string).trim();
  return {
    grpcPort: parsed.data.FONOSTER_FAKE_GRPC_PORT,
    httpsPort: parsed.data.FONOSTER_FAKE_HTTPS_PORT,
    controlPort: parsed.data.FONOSTER_FAKE_CONTROL_PORT,
    tlsCert: value("FONOSTER_FAKE_TLS_CERT"),
    tlsKey: value("FONOSTER_FAKE_TLS_KEY"),
    accessKeyId: value("FONOSTER_FAKE_ACCESS_KEY_ID"),
    apiKey: value("FONOSTER_FAKE_API_KEY"),
    apiSecret: value("FONOSTER_FAKE_API_SECRET"),
    numbers: list(value("FONOSTER_FAKE_NUMBERS")),
    webhookUrl: parsed.data.FONOSTER_FAKE_WEBHOOK_URL,
    webhookSecret: value("FONOSTER_FAKE_WEBHOOK_SECRET"),
    autoCompleteMs: parsed.data.FONOSTER_FAKE_AUTO_COMPLETE_MS,
    llmModels: list(value("FONOSTER_FAKE_LLM_MODELS"))
  };
}
