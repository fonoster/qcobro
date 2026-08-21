-- Second correlation key on a gestión: the provider's own message id, used to match
-- *outbound* delivery events (Resend `email.delivered` / `email.opened` / `email.bounced`).
--
-- EMAIL cannot reuse `providerRef` for this. There it holds the per-attempt reply-to token,
-- which is the only handle an inbound reply carries, while Resend's outbound events carry
-- only the message id. Both keys are needed, so both are stored.
--
-- Purely additive and reversible: nullable, no backfill, no default. Existing rows keep NULL
-- and stay correlatable by `providerRef` exactly as before. Historical EMAIL gestiones stay
-- at `DISPATCHED` because neither provider can replay delivery data for past sends.

ALTER TABLE "account_contact_logs" ADD COLUMN "providerMessageId" TEXT;

-- Unique so a redelivered provider event updates the same row rather than fanning out.
-- Postgres treats NULLs as distinct, so the pre-existing rows do not collide.
CREATE UNIQUE INDEX "account_contact_logs_providerMessageId_key"
  ON "account_contact_logs"("providerMessageId");
