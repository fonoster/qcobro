import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { getLogger } from "@fonoster/logger";
import {
  callEndedDataSchema,
  callFailedDataSchema,
  callRecordSealedDataSchema,
  fonosterWebhookEventSchema,
  type AiConfig,
  type DeliveryReason,
  type FonosterWebhookEvent,
  type InsightGenerator,
  type VoiceCallRecordsClient
} from "@qcobro/common";
import {
  createIngestVoiceEvent,
  type VoiceEventClient
} from "../functions/voice/ingestVoiceEvent.js";
import type { GenerateInsightClient } from "../functions/voice/generateGestionInsight.js";
import type { DecideVoiceOutcomeResult } from "../functions/voice/decideVoiceOutcome.js";
import { createCompleteVoiceAiConversation } from "../functions/voice/completeVoiceAiConversation.js";
import { chatHistoryFromCallRecord } from "../functions/voice/callRecordTranscript.js";
import { mapCallFailedReason } from "../functions/voice/mapCallFailedReason.js";
import type { ProviderEventRecorder } from "../engine/eventSink.js";

const logger = getLogger({ service: "voice-events", filePath: import.meta.url });

const TIMESTAMP_HEADER = "x-fonoster-timestamp";
const SIGNATURE_HEADER = "x-fonoster-signature";
/** A delivery signed more than this far from the server clock is rejected (replay window). */
const MAX_SKEW_SECONDS = 300;
/** Fonoster waits 10 s for the 2xx; the record fetch must give up well before that. */
const DEFAULT_RECORD_FETCH_TIMEOUT_MS = 8_000;

type VoiceOutcomeRecorder = (input: {
  providerRef: string;
  answered: boolean;
  deliveryReason?: DeliveryReason;
  answeredSeconds: number;
  at: string;
}) => Promise<unknown>;

export interface VoiceEventsDeps {
  /** `fonoster.webhookSecret`; null when unset, and the receiver then answers 503. */
  webhookSecret: string | null;
  /** Fonoster call records (the redacted copy), for the transcript on `call_record.sealed`. */
  callRecords: Pick<VoiceCallRecordsClient, "getRecord">;
  /** Insight generator (null when AI insights are disabled). */
  generator: InsightGenerator | null;
  /** Generation mode from the `ai` config. */
  generation: NonNullable<AiConfig>["generation"];
  /** Flight recorder; each call event is recorded best-effort. */
  recordEvent?: ProviderEventRecorder | null;
  /** Voice usage settlement (null when billing is disabled). Idempotent per call ref. */
  settleUsage?:
    | ((input: { providerRef: string; answeredSeconds: number; at: string }) => Promise<unknown>)
    | null;
  /** Finalizes a VOICE_AI gestión's delivery; guarded on DISPATCHED, so it applies once. */
  recordVoiceAiCallStatus: VoiceOutcomeRecorder;
  /** Finalizes a VOICE_PRERECORDED gestión's delivery (only `call.failed` reaches it here). */
  recordPrerecordedOutcome: VoiceOutcomeRecorder;
  /** Voz IA payment-promise capture: the autopilot decision over the final transcript. */
  decideOutcome: (id: string) => Promise<DecideVoiceOutcomeResult>;
  recordFetchTimeoutMs?: number;
  now?: () => Date;
}

/** The gestión a call event is about, as far as this receiver needs to know it. */
export interface VoiceCallLookupClient {
  accountContactLog: {
    findFirst(args: {
      where: { providerRef: string };
      select: { id: true; agentType: true; path: true; channelData: true };
    }): Promise<{
      id: string;
      agentType: string;
      path: string | null;
      channelData: unknown;
    } | null>;
  };
}

/** A signed event whose `data` doesn't match its `type`: answered 400, not retried. */
class BadEventError extends Error {}

/**
 * Checks Fonoster's webhook signature over the raw body bytes: `X-Fonoster-Signature` holds
 * one or more comma-separated hex HMAC-SHA256 values (several during a secret rotation) of
 * `<X-Fonoster-Timestamp>.<raw body>`, keyed with the secret as issued. Any match passes,
 * compared in constant time after a length check. Fails closed on a missing or malformed
 * header and on a timestamp more than {@link MAX_SKEW_SECONDS} from `nowSeconds`.
 */
export function verifyFonosterSignature(
  raw: Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
  nowSeconds: number
): boolean {
  const timestamp = headers[TIMESTAMP_HEADER];
  const signature = headers[SIGNATURE_HEADER];
  if (typeof timestamp !== "string" || !/^\d{1,12}$/.test(timestamp)) return false;
  if (typeof signature !== "string" || signature.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_SKEW_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(raw).digest();
  return signature.split(",").some((candidate) => {
    const given = Buffer.from(candidate.trim(), "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

function parseData<T>(
  schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } },
  data: unknown
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new BadEventError("event data does not match its type");
  return parsed.data;
}

/**
 * Builds the `POST /api/voice/events` receiver for Fonoster's signed workspace webhooks,
 * QCobro's source of voice call results. Mount it with a raw body parser: the signature is
 * checked over the raw bytes before anything is parsed or read from the database.
 *
 * - `call.ended` (VOICE_AI): finalizes DELIVERED with the call's `durationSeconds` and
 *   settles usage with it.
 * - `call.failed` (VOICE_AI or VOICE_PRERECORDED): finalizes FAILED with the mapped reason
 *   and settles usage to zero.
 * - `call_record.sealed` (VOICE_AI): fetches the call record and stores its transcript
 *   before answering, then runs the insight and the decision after answering.
 * - Anything else, a pre-recorded `call.ended`/`call_record.sealed` (its outcome is
 *   recorded in-process by the voice server), and an unknown `callRef`: acknowledged.
 *
 * Every side effect checks the gestión's persisted state, so redeliveries, any event order,
 * later record versions and restarts apply each once. Responses: 200, 401 (bad signature),
 * 400 (signed but malformed), 503 (no secret configured), 500 (Fonoster retries).
 */
export function createVoiceEventsHandler(
  prisma: VoiceCallLookupClient & VoiceEventClient & GenerateInsightClient,
  deps: VoiceEventsDeps
) {
  const now = deps.now ?? (() => new Date());
  const ingest = createIngestVoiceEvent(prisma, now);
  const complete = createCompleteVoiceAiConversation({
    prisma,
    generator: deps.generator,
    generation: deps.generation,
    decideOutcome: deps.decideOutcome
  });
  const recordFetchTimeoutMs = deps.recordFetchTimeoutMs ?? DEFAULT_RECORD_FETCH_TIMEOUT_MS;

  const findGestion = (callRef: string) =>
    prisma.accountContactLog.findFirst({
      where: { providerRef: callRef },
      select: { id: true, agentType: true, path: true, channelData: true }
    });

  /** Handles one event; returns the work owed after the response, if any. */
  async function handle(
    event: FonosterWebhookEvent
  ): Promise<{ matched?: boolean; after?: () => Promise<unknown> }> {
    const at = now().toISOString();

    if (event.type === "call.ended") {
      const { callRef, durationSeconds } = parseData(callEndedDataSchema, event.data);
      const gestion = await findGestion(callRef);
      if (gestion?.agentType !== "VOICE_AI") return { matched: !!gestion };
      await deps.recordVoiceAiCallStatus({
        providerRef: callRef,
        answered: true,
        answeredSeconds: durationSeconds,
        at
      });
      await deps.settleUsage?.({ providerRef: callRef, answeredSeconds: durationSeconds, at });
      return { matched: true };
    }

    if (event.type === "call.failed") {
      const { callRef, reason } = parseData(callFailedDataSchema, event.data);
      const gestion = await findGestion(callRef);
      const record =
        gestion?.agentType === "VOICE_AI"
          ? deps.recordVoiceAiCallStatus
          : gestion?.agentType === "VOICE_PRERECORDED"
            ? deps.recordPrerecordedOutcome
            : null;
      if (!record) return { matched: !!gestion };
      await record({
        providerRef: callRef,
        answered: false,
        deliveryReason: mapCallFailedReason(reason),
        answeredSeconds: 0,
        at
      });
      await deps.settleUsage?.({ providerRef: callRef, answeredSeconds: 0, at });
      return { matched: true };
    }

    if (event.type === "call_record.sealed") {
      const { callRef } = parseData(callRecordSealedDataSchema, event.data);
      const gestion = await findGestion(callRef);
      if (gestion?.agentType !== "VOICE_AI") return { matched: !!gestion };
      // Decided already: a later version, a redelivery, or a restart. Nothing is owed.
      if (gestion.path) return { matched: true };

      const stored = (gestion.channelData as Record<string, unknown> | null)?.transcriptStoredAt;
      if (!stored) {
        const record = await withTimeout(
          deps.callRecords.getRecord(callRef),
          recordFetchTimeoutMs,
          "call record fetch"
        );
        const result = await ingest({ callRef, chatHistory: chatHistoryFromCallRecord(record) });
        // A record with no spoken turns produces no outcome.
        if (!result.matched || !result.stored) return { matched: result.matched };
      }
      return { matched: true, after: () => complete(gestion.id) };
    }

    // call.started, provider.deprecated, and any type added later.
    return {};
  }

  return async (req: Request, res: Response): Promise<void> => {
    if (!deps.webhookSecret) {
      res.status(503).json({ error: "Voice webhook secret is not configured" });
      return;
    }
    const raw = Buffer.isBuffer(req.body) ? req.body : null;
    const nowSeconds = Math.floor(now().getTime() / 1000);
    if (!raw || !verifyFonosterSignature(raw, req.headers, deps.webhookSecret, nowSeconds)) {
      logger.warn("rejected a voice event with a missing or invalid signature");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    let event: FonosterWebhookEvent;
    try {
      event = fonosterWebhookEventSchema.parse(JSON.parse(raw.toString("utf8")));
    } catch {
      res.status(400).json({ error: "Malformed event" });
      return;
    }
    logger.verbose(`received type=${event.type} id=${event.id}`);

    let outcome: Awaited<ReturnType<typeof handle>>;
    try {
      outcome = await handle(event);
    } catch (err) {
      if (err instanceof BadEventError) {
        logger.error(`400 ${event.type} id=${event.id}: ${err.message}`);
        res.status(400).json({ error: "Malformed event" });
        return;
      }
      logger.error(
        `failed to handle ${event.type} id=${event.id}: ${err instanceof Error ? err.message : err}`
      );
      res.status(500).json({ error: "Failed to handle voice event" });
      return;
    }

    res.status(200).json({ received: true });

    const callRef = typeof event.data.callRef === "string" ? event.data.callRef : undefined;
    if (callRef) {
      deps.recordEvent?.({
        providerRef: callRef,
        matched: outcome.matched,
        summary: { eventType: event.type }
      });
    }

    // Insight and decision run after the response; a failure leaves the gestión undecided
    // and the sweep's recovery runs them again.
    outcome
      .after?.()
      .catch((err: unknown) =>
        logger.error(
          `voice insight/decision failed for callRef=${callRef}: ${err instanceof Error ? err.message : err}`
        )
      );
  };
}
