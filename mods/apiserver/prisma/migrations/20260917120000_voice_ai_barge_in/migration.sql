-- Per-template barge-in on VOICE_AI agents: `allowUserBargeIn` lets the caller interrupt the
-- agent while it speaks. Until now it was a hard-coded `false` in autopilotTemplate.json,
-- applied to every synced Voz IA app.
--
-- NOT NULL DEFAULT false: there is nothing to back-fill, and `false` is exactly the behavior
-- every existing template had before this column existed.

ALTER TABLE "voice_ai_configs" ADD COLUMN "allowUserBargeIn" BOOLEAN NOT NULL DEFAULT false;
