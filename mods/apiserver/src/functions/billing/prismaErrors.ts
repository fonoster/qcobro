/**
 * Prisma unique-constraint violation (P2002), matched without importing Prisma
 * so the billing functions stay client-agnostic. The idempotent replay paths
 * (cycle turnover, checkout provisioning, subscribe compensation) all key on
 * this — one definition so "what counts as a duplicate" cannot diverge.
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}
