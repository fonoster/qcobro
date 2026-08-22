-- `contact_log_axes` (20260819120000) added `account_contact_logs_one_way_channel_check` as a
-- DB-level guard mirroring the application's `channelCanEngage` rule: a one-way channel
-- (VOICE_PRERECORDED, SMS) could never carry a non-null `camino`/`resultado`. This migration's
-- Zod-level counterpart (see `createContactLogSchema` / `isAllowedOnPrerecorded` in
-- `@qcobro/common`) narrowed that to "VOICE_PRERECORDED may carry `camino = 'ENGAGED'` and/or
-- `resultado = 'OPT_OUT'` — from its optional DTMF menu — and nothing else, still zero for
-- every other one-way channel" — but this constraint was never updated to match, so a write
-- the application layer now accepts was still rejected at the database with a check-constraint
-- violation. This migration is the fix: same guard, same channels, the one narrow exception
-- added explicitly rather than a blanket allowance for the whole channel.
ALTER TABLE "account_contact_logs"
  DROP CONSTRAINT "account_contact_logs_one_way_channel_check";

ALTER TABLE "account_contact_logs"
  ADD CONSTRAINT "account_contact_logs_one_way_channel_check"
  CHECK (
    "agentType" IN ('VOICE_AI', 'EMAIL', 'WHATSAPP')
    OR (
      ("camino" IS NULL OR ("agentType" = 'VOICE_PRERECORDED' AND "camino" = 'ENGAGED'))
      AND
      ("resultado" IS NULL OR ("agentType" = 'VOICE_PRERECORDED' AND "resultado" = 'OPT_OUT'))
    )
  );
