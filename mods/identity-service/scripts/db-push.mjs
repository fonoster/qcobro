import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

// Provision the Identity database from qcobro.json (single source of truth).
// The Prisma CLI reads the connection from IDENTITY_DATABASE_URL (see schema.prisma).
const configPath = process.env.QCOBRO_CONFIG ?? resolve(process.cwd(), "../../qcobro.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

execFileSync("npx", ["--no-install", "prisma", "db", "push", "--schema", "prisma/schema.prisma", "--skip-generate"], {
  stdio: "inherit",
  env: { ...process.env, IDENTITY_DATABASE_URL: config.identity.databaseUrl }
});
