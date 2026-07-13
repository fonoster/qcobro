/**
 * Server process configuration, read from environment variables. Names match
 * `@qcobro/common`'s `engine-eval` CLI convention (`QCOBRO_ACCESS_KEY_ID` /
 * `QCOBRO_ACCESS_KEY_SECRET` / default endpoint `https://api.qcobro.com`), plus
 * `QCOBRO_WORKSPACE` for the workspace this server acts in.
 */

export const DEFAULT_ENDPOINT = "https://api.qcobro.com";

export interface ServerEnv {
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  workspace: string;
}

/** Raised when required configuration is missing. */
export class EnvError extends Error {}

const REQUIRED_VARS = [
  "QCOBRO_ACCESS_KEY_ID",
  "QCOBRO_ACCESS_KEY_SECRET",
  "QCOBRO_WORKSPACE"
] as const;

/** Reads and validates the server's environment. Throws {@link EnvError} on the first missing variable. */
export function readServerEnv(env: Record<string, string | undefined> = process.env): ServerEnv {
  for (const name of REQUIRED_VARS) {
    if (!env[name]) {
      throw new EnvError(`Missing required environment variable: ${name}`);
    }
  }
  return {
    endpoint: env.QCOBRO_ENDPOINT || DEFAULT_ENDPOINT,
    accessKeyId: env.QCOBRO_ACCESS_KEY_ID as string,
    accessKeySecret: env.QCOBRO_ACCESS_KEY_SECRET as string,
    workspace: env.QCOBRO_WORKSPACE as string
  };
}
