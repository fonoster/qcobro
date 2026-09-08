-- Two new DeliveryReason values for the voice completion sweep, which now classifies a
-- stuck-at-DISPATCHED voice gestión from Fonoster's call detail record (CDR) instead of
-- always writing PROVIDER_ERROR:
--
--   * OUTCOME_UNKNOWN — the call connected and cleared normally, but QCobro's own
--     completion signal never arrived, so it cannot say what happened during the call.
--   * NOT_ORIGINATED — the provider has no record of the call at all (a Fonoster
--     Calls.GetCall NOT_FOUND); the call never happened.
--
-- Purely additive — `ALTER TYPE ... ADD VALUE` appends to the existing enum without
-- touching any stored row, so this needs no backfill and is safe to run without downtime.
ALTER TYPE "DeliveryReason" ADD VALUE 'OUTCOME_UNKNOWN';
ALTER TYPE "DeliveryReason" ADD VALUE 'NOT_ORIGINATED';
