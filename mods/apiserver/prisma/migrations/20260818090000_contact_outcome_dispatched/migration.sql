-- Reshape ContactOutcome: drop OTHER (a catch-all that asserted nothing about the
-- attempt), add DISPATCHED (the dispatch-time placeholder). Postgres has no
-- `ALTER TYPE ... DROP VALUE`, so the type is recreated in one migration, with the
-- remap done in the `USING` clause of the column's type change — this also sidesteps
-- the "new enum value cannot be used in the transaction that added it" restriction
-- that `ADD VALUE` would trigger.
--
-- Old OTHER rows become DISPATCHED. The migration cannot tell an old dispatch
-- placeholder from an old autopilot escalation, and does not need to: today every
-- code path already treats OTHER as "not yet finalized", and DISPATCHED is the
-- conservative direction for a KPI whose defect was over-counting contact.
ALTER TYPE "ContactOutcome" RENAME TO "ContactOutcome_old";

CREATE TYPE "ContactOutcome" AS ENUM (
  'DISPATCHED',
  'DELIVERED',
  'NOT_DELIVERED',
  'NO_ANSWER',
  'PAYMENT_PROMISE',
  'PARTIAL_PAYMENT_AGREED',
  'NEW_TERMS',
  'CALLBACK_REQUESTED',
  'DISPUTE_RAISED',
  'INFORMATION_REQUEST',
  'RESOLVED',
  'PAID',
  'WRONG_NUMBER',
  'OPT_OUT',
  'REFUSED'
);

ALTER TABLE "account_contact_logs"
  ALTER COLUMN "outcome" TYPE "ContactOutcome"
  USING (
    CASE WHEN "outcome"::text = 'OTHER' THEN 'DISPATCHED' ELSE "outcome"::text END
  )::"ContactOutcome";

DROP TYPE "ContactOutcome_old";
