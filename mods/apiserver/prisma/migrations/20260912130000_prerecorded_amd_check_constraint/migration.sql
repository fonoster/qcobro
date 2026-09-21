-- `account_contact_logs_one_way_channel_check` (introduced by `20260819120000`, narrowed for
-- the DTMF menu by `20260822010000`) is a DB-level guard mirroring the application's
-- `isAllowedOnPrerecorded` rule, and — same as that earlier fix — it was not updated when the
-- application layer changed: `20260912120000_voice_amd_detection` taught the Zod schema that
-- `VOICE_PRERECORDED` can also carry `path = 'ANSWERED_BY_MACHINE'` (a detected answering
-- machine hanging up the call before the script plays), but this constraint still only allowed
-- `'ENGAGED'`, so that now-valid write was rejected at the database with a check-constraint
-- violation. Same guard, same channels, the one additional value added explicitly.
ALTER TABLE "account_contact_logs"
  DROP CONSTRAINT "account_contact_logs_one_way_channel_check";

ALTER TABLE "account_contact_logs"
  ADD CONSTRAINT "account_contact_logs_one_way_channel_check"
  CHECK (
    "agentType" IN ('VOICE_AI', 'EMAIL', 'WHATSAPP')
    OR (
      ("path" IS NULL OR ("agentType" = 'VOICE_PRERECORDED' AND "path" IN ('ENGAGED', 'ANSWERED_BY_MACHINE')))
      AND
      ("outcome" IS NULL OR ("agentType" = 'VOICE_PRERECORDED' AND "outcome" = 'OPT_OUT'))
    )
  );
