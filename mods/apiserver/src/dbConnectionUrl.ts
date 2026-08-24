/**
 * Sane connection-level defaults for the Postgres URL, applied unless the deployment's own
 * `database.url` already sets them explicitly (an operator's explicit choice always wins).
 *
 * Without these, a single query that hangs client-side — a stale TCP connection after a
 * network blip, a connection-pool slot that never frees — waits forever: Postgres's own
 * `statement_timeout` only bounds queries it is actively executing, not a client stuck
 * waiting on a response that never arrives, and Prisma applies none of these by default.
 * `connect_timeout` bounds acquiring a new connection; `socket_timeout` bounds waiting for
 * any single query's response. Both are real `@prisma/client` PostgreSQL connector
 * parameters (https://www.prisma.io/docs/orm/overview/databases/postgresql), not invented.
 */
import { getLogger } from "@fonoster/logger";

const logger = getLogger({ service: "db", filePath: import.meta.url });

const DEFAULT_CONNECT_TIMEOUT_SECONDS = "10";
const DEFAULT_SOCKET_TIMEOUT_SECONDS = "30";

/**
 * Fails open on a connection-string shape the WHATWG `URL` parser can't handle but Prisma's
 * Postgres connector accepts and this repo must not reject at boot — notably the Unix-socket
 * form (`postgresql://user:pass@/db?host=/cloudsql/instance`, empty host), which `new URL()`
 * throws on. Rather than risk crashing a previously-working deployment, an unparseable URL is
 * returned unchanged (no timeout defaults applied) with a loud warning, instead of failing boot.
 */
export function withConnectionTimeouts(databaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    logger.warn(
      "could not parse database.url to apply default connect_timeout/socket_timeout " +
        "(this is expected for some Unix-socket connection strings) — using it unchanged. " +
        "Set connect_timeout/socket_timeout in it directly if you want them bounded."
    );
    return databaseUrl;
  }
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", DEFAULT_CONNECT_TIMEOUT_SECONDS);
  }
  if (!url.searchParams.has("socket_timeout")) {
    url.searchParams.set("socket_timeout", DEFAULT_SOCKET_TIMEOUT_SECONDS);
  }
  return url.toString();
}
