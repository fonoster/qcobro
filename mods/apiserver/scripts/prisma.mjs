import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

// Runs the Prisma CLI with DATABASE_URL sourced from qcobro.json, so migrations
// share the single config source of truth.
//
// qcobro.json is the source of truth when present. When it is absent — e.g. the
// `prisma generate` that runs during a Docker image build or in CI, where no
// real database exists — fall back to DATABASE_URL from the environment.
// `generate` never connects, so it works even with no URL at all; commands that
// do connect (migrate, db push) still require a real URL via either source.
const configPath = process.env.QCOBRO_CONFIG ?? resolve(process.cwd(), "../../qcobro.json");

let databaseUrl = process.env.DATABASE_URL;
try {
  databaseUrl = JSON.parse(readFileSync(configPath, "utf8")).database.url;
} catch {
  // No qcobro.json — keep the environment's DATABASE_URL (possibly undefined).
}

execFileSync("npx", ["--no-install", "prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) }
});
