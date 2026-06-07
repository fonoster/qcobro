import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

// Runs the Prisma CLI with DATABASE_URL sourced from qcobro.json, so migrations
// share the single config source of truth (the CLI requires the env var).
const configPath = process.env.QCOBRO_CONFIG ?? resolve(process.cwd(), "../../qcobro.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

execFileSync("npx", ["--no-install", "prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: config.database.url }
});
