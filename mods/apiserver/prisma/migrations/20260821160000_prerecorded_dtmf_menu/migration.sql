-- Optional DTMF menu on pre-recorded voice templates (issue #88): a "repeat" digit that
-- replays the script and an "opt-out" digit that ends the call and records `resultado:
-- OPT_OUT` on the gestión. Both independently optional; unset means no menu at all, which
-- is the pre-existing behavior.
--
-- Purely additive and reversible: all five columns are nullable, no backfill, no default.
-- Existing rows keep every column NULL and are behaviorally identical to before this change.

ALTER TABLE "voice_prerecorded_configs" ADD COLUMN "repeatDigit" TEXT;
ALTER TABLE "voice_prerecorded_configs" ADD COLUMN "repeatMessage" TEXT;
ALTER TABLE "voice_prerecorded_configs" ADD COLUMN "maxRepeats" INTEGER;
ALTER TABLE "voice_prerecorded_configs" ADD COLUMN "optOutDigit" TEXT;
ALTER TABLE "voice_prerecorded_configs" ADD COLUMN "optOutMessage" TEXT;
