-- Split the flattened `ContactOutcome` into three independent axes: `entrega` (did it reach
-- the device/inbox, plus a `deliveryReason` on failure), `camino` (what path the interaction
-- took), and `resultado` (what came of it).
--
-- Postgres cannot ALTER TYPE ... DROP VALUE, so every affected enum is created fresh and the
-- old one dropped once nothing references it.
--
-- IRREVERSIBLE. `DROP TYPE "ContactOutcome"` cannot be undone by redeploying old code; the
-- only rollback is a database restore. Take a verified backup first.

-- ---------------------------------------------------------------------------
-- 1. The three new axes
-- ---------------------------------------------------------------------------

CREATE TYPE "Entrega" AS ENUM ('DISPATCHED', 'DELIVERED', 'FAILED');

CREATE TYPE "DeliveryReason" AS ENUM (
  'NO_ANSWER', 'BUSY', 'UNREACHABLE', 'PROVIDER_ERROR',
  'CHANNEL_UNSUPPORTED', 'INVALID_DESTINATION', 'REJECTED'
);

CREATE TYPE "Camino" AS ENUM ('ENGAGED', 'ABANDONED', 'VOICEMAIL');

CREATE TYPE "Resultado" AS ENUM (
  'PAYMENT_PROMISE', 'NEW_TERMS', 'PAID', 'CALLBACK_REQUESTED', 'DISPUTE_RAISED',
  'INFORMATION_REQUEST', 'REFUSED', 'OPT_OUT', 'WRONG_PARTY', 'RESOLVED'
);

ALTER TABLE "account_contact_logs"
  ADD COLUMN "entrega"        "Entrega" NOT NULL DEFAULT 'DISPATCHED',
  ADD COLUMN "deliveryReason" "DeliveryReason",
  ADD COLUMN "camino"         "Camino",
  ADD COLUMN "resultado"      "Resultado";

-- Back-fill. Two deliberate imprecisions, both irreversible in the old data and both
-- conservative:
--
--   * WRONG_NUMBER becomes a delivery failure rather than resultado WRONG_PARTY. The old
--     value cannot distinguish a carrier rejection from a human saying "that's not me", and
--     calling a carrier rejection an engagement would inflate the contactability numerator.
--     Historical wrong-party conversations are therefore undercounted; going forward the two
--     are distinct.
--   * NOT_DELIVERED becomes UNREACHABLE, the least specific reason, because the old value
--     carried none.
UPDATE "account_contact_logs" SET
  "entrega" = CASE "outcome"::text
    WHEN 'OTHER'         THEN 'DISPATCHED'
    WHEN 'NOT_DELIVERED' THEN 'FAILED'
    WHEN 'NO_ANSWER'     THEN 'FAILED'
    WHEN 'WRONG_NUMBER'  THEN 'FAILED'
    ELSE 'DELIVERED'
  END::"Entrega",
  "deliveryReason" = CASE "outcome"::text
    WHEN 'NOT_DELIVERED' THEN 'UNREACHABLE'
    WHEN 'NO_ANSWER'     THEN 'NO_ANSWER'
    WHEN 'WRONG_NUMBER'  THEN 'INVALID_DESTINATION'
    ELSE NULL
  END::"DeliveryReason",
  -- SMS and VOICE_PRERECORDED have no inbound path, so neither axis is reachable on them.
  -- The old ingress did not enforce that, so a historical row on those channels can carry a
  -- conversational outcome; back-filling it would create data the application now rejects.
  "camino" = CASE
    WHEN "agentType"::text NOT IN ('VOICE_AI', 'EMAIL', 'WHATSAPP') THEN NULL
    WHEN "outcome"::text IN ('OTHER', 'DELIVERED', 'NOT_DELIVERED', 'NO_ANSWER', 'WRONG_NUMBER')
      THEN NULL
    ELSE 'ENGAGED'
  END::"Camino",
  "resultado" = CASE
    WHEN "agentType"::text NOT IN ('VOICE_AI', 'EMAIL', 'WHATSAPP') THEN NULL
    ELSE CASE "outcome"::text
    WHEN 'PAYMENT_PROMISE'         THEN 'PAYMENT_PROMISE'
    WHEN 'PARTIAL_PAYMENT_AGREED'  THEN 'PAYMENT_PROMISE'
    WHEN 'NEW_TERMS'               THEN 'NEW_TERMS'
    WHEN 'PAID'                    THEN 'PAID'
    WHEN 'CALLBACK_REQUESTED'      THEN 'CALLBACK_REQUESTED'
    WHEN 'DISPUTE_RAISED'          THEN 'DISPUTE_RAISED'
    WHEN 'INFORMATION_REQUEST'     THEN 'INFORMATION_REQUEST'
    WHEN 'REFUSED'                 THEN 'REFUSED'
    WHEN 'OPT_OUT'                 THEN 'OPT_OUT'
    WHEN 'RESOLVED'                THEN 'RESOLVED'
    ELSE NULL
  END
  END::"Resultado";

-- Guard the two invariants the application also enforces, so neither can be violated by a
-- direct write or a future migration: a reason iff a failure, and no interaction recorded on
-- a channel that cannot observe one.
ALTER TABLE "account_contact_logs"
  ADD CONSTRAINT "account_contact_logs_delivery_reason_check"
  CHECK (("entrega" = 'FAILED') = ("deliveryReason" IS NOT NULL));

ALTER TABLE "account_contact_logs"
  ADD CONSTRAINT "account_contact_logs_one_way_channel_check"
  CHECK (
    "agentType" IN ('VOICE_AI', 'EMAIL', 'WHATSAPP')
    OR ("camino" IS NULL AND "resultado" IS NULL)
  );

ALTER TABLE "account_contact_logs" DROP COLUMN "outcome";
DROP TYPE "ContactOutcome";

CREATE INDEX "account_contact_logs_entrega_idx"   ON "account_contact_logs"("entrega");
CREATE INDEX "account_contact_logs_resultado_idx" ON "account_contact_logs"("resultado");

-- ---------------------------------------------------------------------------
-- 2. IntentStatus loses WRONG_NUMBER and OPT_OUT
-- ---------------------------------------------------------------------------
--
-- The engine no longer benches an account for a bad number or for an opt-out claim made
-- during an interaction. Both are recorded on the gestión; acting on them becomes an explicit
-- Do Not Contact entry (issue #101). INTENT_MET survives because it describes the debt —
-- settled, nothing left to collect — rather than a contact point.

-- Accounts about to lose an OPT_OUT flag are people who already asked not to be contacted,
-- and they re-enter campaign rotation the moment it is cleared. Preserve them here so the DNC
-- list can be seeded from real data rather than from someone remembering to run a SELECT
-- first. Issue #101 consumes this table and drops it.
CREATE TABLE "dnc_seed_from_intent_status" AS
SELECT "id" AS "portfolioAccountId",
       "intentStatus"::text AS "reason",
       now() AS "capturedAt"
FROM "portfolio_accounts"
WHERE "intentStatus"::text IN ('OPT_OUT', 'WRONG_NUMBER');

COMMENT ON TABLE "dnc_seed_from_intent_status" IS
  'Seed data for the workspace Do Not Contact list (issue #101): accounts whose intentStatus was cleared by the contact-log-axes migration. Drop once consumed.';

UPDATE "portfolio_accounts"
SET "intentStatus" = NULL
WHERE "intentStatus"::text IN ('OPT_OUT', 'WRONG_NUMBER');

ALTER TYPE "IntentStatus" RENAME TO "IntentStatus_old";
CREATE TYPE "IntentStatus" AS ENUM ('INTENT_MET');
ALTER TABLE "portfolio_accounts"
  ALTER COLUMN "intentStatus" TYPE "IntentStatus"
  USING ("intentStatus"::text::"IntentStatus");
DROP TYPE "IntentStatus_old";

-- ---------------------------------------------------------------------------
-- 3. TriggerType loses WRONG_NUMBER and OPT_OUT
-- ---------------------------------------------------------------------------

DELETE FROM "campaign_triggers" WHERE "type"::text IN ('WRONG_NUMBER', 'OPT_OUT');

ALTER TYPE "TriggerType" RENAME TO "TriggerType_old";
CREATE TYPE "TriggerType" AS ENUM (
  'MAX_ATTEMPTS_PER_DAY', 'DNC_CHECK', 'PAYMENT_PROMISE', 'INTENT_MET', 'CALLBACK_REQUESTED'
);
ALTER TABLE "campaign_triggers"
  ALTER COLUMN "type" TYPE "TriggerType"
  USING ("type"::text::"TriggerType");
DROP TYPE "TriggerType_old";
