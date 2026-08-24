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
const DEFAULT_CONNECT_TIMEOUT_SECONDS = "10";
const DEFAULT_SOCKET_TIMEOUT_SECONDS = "30";

export function withConnectionTimeouts(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", DEFAULT_CONNECT_TIMEOUT_SECONDS);
  }
  if (!url.searchParams.has("socket_timeout")) {
    url.searchParams.set("socket_timeout", DEFAULT_SOCKET_TIMEOUT_SECONDS);
  }
  return url.toString();
}
