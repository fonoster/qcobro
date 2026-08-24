import { getLogger } from "@fonoster/logger";

const logger = getLogger({ service: "db", filePath: import.meta.url });

/**
 * Applies a server-side `statement_timeout` to the Postgres connection URL, via libpq's
 * `options` parameter, so Postgres itself cancels a statement that runs too long.
 *
 * Server-side is the operative word. A client-side timeout (Prisma's `socket_timeout`) only
 * stops the client waiting: the server keeps executing the statement, so the connection stays
 * busy and any session-scoped advisory lock it holds stays held — which is exactly how one
 * stalled query can freeze the whole campaigns engine. Cancelling server-side frees the
 * connection, which releases the lock and lets the engine resume.
 *
 * An operator's own `statement_timeout` in `database.url` always wins, and a URL this cannot
 * parse is returned unchanged (some valid Postgres connection strings, e.g. the Cloud SQL
 * Unix-socket form, are not parseable as a WHATWG URL) rather than failing boot.
 */
export function withStatementTimeout(databaseUrl: string, timeoutMs: number): string {
  if (timeoutMs <= 0) return databaseUrl; // explicitly disabled

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    logger.warn(
      "could not parse database.url, so no statement_timeout was applied (expected for some " +
        "Unix-socket connection strings). Set `-c statement_timeout=...` in its `options` " +
        "parameter directly to bound statements on this deployment."
    );
    return databaseUrl;
  }

  const existing = url.searchParams.get("options") ?? "";
  if (/statement_timeout/i.test(existing)) return databaseUrl; // operator's choice wins

  url.searchParams.set("options", `${existing} -c statement_timeout=${timeoutMs}`.trim());
  return url.toString();
}
