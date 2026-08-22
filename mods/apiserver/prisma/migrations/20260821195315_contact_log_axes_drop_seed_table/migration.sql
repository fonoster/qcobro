-- `contact_log_axes` (20260819120000) created `dnc_seed_from_intent_status` as a scratch
-- table for its own backfill step, but never dropped it. `schema.prisma` has no model for
-- it, so any fresh `prisma migrate dev` run detects this as drift and stops to prompt for a
-- new migration name -- interactively, which hangs indefinitely in a non-interactive shell
-- (found while bringing up a from-scratch dev database for issue #88's local verification).
-- Purely additive-safe: the table was intermediate/scratch, never modeled, never read after
-- the backfill it fed.

/*
  Warnings:

  - You are about to drop the `dnc_seed_from_intent_status` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "dnc_seed_from_intent_status";
