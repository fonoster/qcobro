import { homedir } from "node:os";
import { join } from "node:path";

export const BASE_DIR = join(homedir(), ".qcobro");
export const CONFIG_FILE = join(homedir(), ".qcobro", "config.json");

/**
 * Default QCobro API endpoint. Matches `@qcobro/sdk`'s own default (not
 * exported by the SDK, so mirrored here) and `@qcobro/mcp`'s
 * `DEFAULT_ENDPOINT` convention.
 */
export const DEFAULT_ENDPOINT = "https://api.qcobro.com";
