-- Per-template Fonoster AUTOPILOT idle options on VOICE_AI agents: the line spoken when the
-- caller goes silent (`idleMessage`), how long to wait for speech before speaking it
-- (`idleTimeout`, milliseconds), and how many consecutive idle timeouts to tolerate before
-- hanging up (`idleMaxTimeoutCount`). Until now these were a single shared block in
-- autopilotTemplate.json applied identically to every synced Voz IA app (PR #165).
--
-- The columns are NOT NULL. Added nullable, back-filled for every existing row, then
-- constrained -- the repo's standard add/backfill/constrain sequence (see
-- 20260819120000_contact_log_axes).
--
-- The back-fill values mirror `DEFAULT_VOICE_IDLE_OPTIONS` in `@qcobro/common`
-- (mods/common/src/schemas/agentTemplates.ts), the single source of truth. `idleTimeout`
-- 8000 deliberately supersedes PR #165's 4500 for already-created templates; they pick it
-- up on their next Fonoster re-sync.

ALTER TABLE "voice_ai_configs" ADD COLUMN "idleMessage" TEXT;
ALTER TABLE "voice_ai_configs" ADD COLUMN "idleTimeout" INTEGER;
ALTER TABLE "voice_ai_configs" ADD COLUMN "idleMaxTimeoutCount" INTEGER;

UPDATE "voice_ai_configs" SET
  "idleMessage" = '¿Se encuentra en la línea? Necesito confirmar una fecha de pago para su cuenta.',
  "idleTimeout" = 8000,
  "idleMaxTimeoutCount" = 3
WHERE "idleMessage" IS NULL;

ALTER TABLE "voice_ai_configs" ALTER COLUMN "idleMessage" SET NOT NULL;
ALTER TABLE "voice_ai_configs" ALTER COLUMN "idleTimeout" SET NOT NULL;
ALTER TABLE "voice_ai_configs" ALTER COLUMN "idleMaxTimeoutCount" SET NOT NULL;
