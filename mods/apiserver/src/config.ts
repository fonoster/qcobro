import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { qcobroConfigSchema } from "@qcobro/common";

/**
 * Service configuration loaded from qcobro.json (Zod-validated). Path via
 * QCOBRO_CONFIG, defaulting to config/qcobro.json at the repo root relative
 * to this package's working directory.
 */
const configPath = process.env.QCOBRO_CONFIG ?? resolve(process.cwd(), "../../config/qcobro.json");
export const config = qcobroConfigSchema.parse(JSON.parse(readFileSync(configPath, "utf8")));
