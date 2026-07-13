#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { alignColumns } from "./tableFormat.js";

/**
 * `list-users` — the npx-runnable admin report (issue #42). Connects directly
 * to the Fonoster Identity Postgres database (a separate database from the
 * qcobro app DB — see `database.url` in `identity.json`) and prints every
 * user with their signup date and workspace count. Intended for an operator
 * with direct DB access (e.g. a DigitalOcean droplet) who wants a quick
 * account census without a manual SQL session. All imports below are
 * relative (this file ships inside `@qcobro/common`; it must not import its
 * own package by name).
 */

export interface CliOptions {
  databaseUrl?: string;
  json: boolean;
  help: boolean;
}

export const USAGE = `Usage: list-users [options]

List every Fonoster Identity user with their signup date and workspace count
(owned + member, deduplicated), newest signups first.

Options:
  --database-url <url>  Identity Postgres connection string
                         (or QCOBRO_IDENTITY_DATABASE_URL)
  --json                 Print the rows as JSON instead of a table
  --help                 Show this help
`;

/** Raised for usage or database-connection failures. */
export class CliError extends Error {}

const OPTION_SPEC = {
  "database-url": { type: "string" },
  json: { type: "boolean", default: false },
  help: { type: "boolean", default: false }
} as const;

/** Parses argv into typed options. Throws `CliError` on malformed flags. */
export function parseCliArgs(argv: string[]): CliOptions {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: OPTION_SPEC, allowPositionals: false }));
  } catch (err) {
    throw new CliError(`Invalid arguments: ${err instanceof Error ? err.message : String(err)}`);
  }
  return {
    databaseUrl: values["database-url"],
    json: values.json ?? false,
    help: values.help ?? false
  };
}

/** Resolves the Identity database URL from a flag, falling back to an env var. */
export function resolveDatabaseUrl(
  opts: Pick<CliOptions, "databaseUrl">,
  env: Record<string, string | undefined>
): string {
  const databaseUrl = opts.databaseUrl ?? env.QCOBRO_IDENTITY_DATABASE_URL;
  if (!databaseUrl) {
    throw new CliError(
      "Missing Identity database URL: pass --database-url or set " + "QCOBRO_IDENTITY_DATABASE_URL"
    );
  }
  return databaseUrl;
}

export interface UserRow {
  ref: string;
  email: string;
  name: string;
  createdAt: string;
  workspaceCount: number;
}

/**
 * node-postgres parses a connection string's `sslmode` differently from
 * libpq: `require`/`prefer`/`verify-ca`/`verify-full` all become a *verifying*
 * TLS config, which fails against a DigitalOcean managed database unless its
 * CA bundle is trusted locally. The rest of this repo's admin tooling (see
 * "Cleaning up gestiones" in the README) already accepts `sslmode=require` as
 * meaning "encrypted, not verified" (libpq/psql semantics) — match that here
 * so the same `DATABASE_URL`-style connection string works with both tools.
 */
function poolConfig(connectionString: string) {
  const sslRequested = /sslmode=(require|prefer|verify-ca|verify-full|no-verify)/.test(
    connectionString
  );
  return {
    connectionString,
    ssl: sslRequested ? { rejectUnauthorized: false } : undefined
  };
}

/**
 * Every user, with their signup date and a deduplicated count of workspaces
 * they own or belong to. The UNION dedupes a workspace an owner might also
 * hold a WorkspaceMember row for, without depending on whether Identity
 * always creates that row.
 */
const USERS_QUERY = `
  SELECT
    u.ref,
    u.email,
    u.name,
    u.created_at AS "createdAt",
    count(DISTINCT ws.ref) AS "workspaceCount"
  FROM users u
  LEFT JOIN (
    SELECT owner_ref AS user_ref, ref FROM workspaces
    UNION
    SELECT user_ref, workspace_ref AS ref FROM workspace_members
  ) ws ON ws.user_ref = u.ref
  GROUP BY u.ref, u.email, u.name, u.created_at
  ORDER BY u.created_at DESC
`;

/** Queries Identity's database directly. Exported so tests can substitute a stub. */
export async function queryUsers(databaseUrl: string): Promise<UserRow[]> {
  const pool = new Pool(poolConfig(databaseUrl));
  try {
    const { rows } = await pool.query(USERS_QUERY);
    return rows.map((row) => ({
      ref: row.ref,
      email: row.email,
      name: row.name,
      createdAt: new Date(row.createdAt).toISOString(),
      workspaceCount: Number(row.workspaceCount)
    }));
  } finally {
    await pool.end();
  }
}

/** Renders the user rows as a plain-ASCII table. */
export function formatTable(users: UserRow[]): string {
  if (users.length === 0) return "(no users found)";
  return alignColumns([
    ["email", "name", "created", "workspaces"],
    ...users.map((u) => [u.email, u.name, u.createdAt.slice(0, 10), String(u.workspaceCount)])
  ]).join("\n");
}

/**
 * Entry point. Exported (rather than only run inline) so it can be exercised
 * directly if ever needed; the module also self-invokes when run via `node`
 * or `npx` (see the guard at the bottom of the file). `queryUsersFn` is
 * injectable so tests can substitute a stub instead of a live database.
 */
export async function main(
  argv: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
  stdout: (s: string) => void = (s) => process.stdout.write(s),
  stderr: (s: string) => void = (s) => process.stderr.write(s),
  queryUsersFn: (databaseUrl: string) => Promise<UserRow[]> = queryUsers
): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCliArgs(argv);
  } catch (err) {
    stderr(`list-users: ${err instanceof Error ? err.message : String(err)}\n\n${USAGE}`);
    return 2;
  }
  if (opts.help) {
    stdout(USAGE);
    return 0;
  }

  try {
    const databaseUrl = resolveDatabaseUrl(opts, env);
    const users = await queryUsersFn(databaseUrl);
    if (opts.json) {
      stdout(JSON.stringify(users, null, 2) + "\n");
    } else {
      stdout(formatTable(users) + "\n");
    }
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stderr(`list-users: ${message}\n`);
    return 2;
  }
}

// Only run when this file is the process entry point (not when imported by tests).
// Compares resolved real paths, not raw strings: npm/npx always launch bins through
// a node_modules/.bin symlink, so argv[1] is the symlink path while import.meta.url
// is already resolved to the real file — a raw-string comparison never matches there,
// silently skipping main() with no output and exit code 0.
if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().then((code) => process.exit(code));
}
