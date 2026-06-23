import { readFileSync } from "node:fs";

/**
 * Reads provider API keys from the Fonoster integrations file (the same place the
 * platform stores them), so demo/dev setups don't have to duplicate keys in
 * qcobro.json. Path defaults to the local checkout; override with
 * `FONOSTER_INTEGRATIONS_PATH`. Keyed by the integration's `productRef`
 * (e.g. `llm.google`, `tts.elevenlabs`).
 */
const INTEGRATIONS_PATH =
  process.env.FONOSTER_INTEGRATIONS_PATH ??
  "/Users/psanders/Projects/fonoster/config/integrations.json";

const cache = new Map<string, string | null>();

export function readIntegrationApiKey(productRef: string): string | null {
  if (cache.has(productRef)) return cache.get(productRef) ?? null;
  let key: string | null = null;
  try {
    const list = JSON.parse(readFileSync(INTEGRATIONS_PATH, "utf8")) as {
      productRef?: string;
      credentials?: { apiKey?: string };
    }[];
    key = list.find((i) => i?.productRef === productRef)?.credentials?.apiKey ?? null;
  } catch {
    key = null;
  }
  cache.set(productRef, key);
  return key;
}
