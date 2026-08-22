-- Closes the opt-out interaction out for the caller: played once the opt-out digit is
-- detected, before hangup ("hemos registrado su solicitud"). Without it the call just ends
-- with no acknowledgment -- the gap this migration fixes.
--
-- Purely additive and reversible: nullable, no backfill, no default. Existing rows keep
-- NULL and are behaviorally unchanged.
ALTER TABLE "voice_prerecorded_configs" ADD COLUMN "optOutConfirmationMessage" TEXT;
