import type { DeliveryReason, VoiceCallStatusTracker } from "@qcobro/common";

const NORMAL_CLEARING_STATUSES = new Set(["NORMAL_CLEARING"]);

/**
 * Fonoster's SIP-cause-level `CallStatus` → `deliveryReason`, for a call that did not
 * clear normally. Only the codes this codebase branches on today are listed; anything else
 * (or an unrecognized status) falls back to the generic `PROVIDER_ERROR` bucket.
 */
const CLEARING_CAUSE_REASON: Readonly<Record<string, DeliveryReason>> = {
  NO_ANSWER: "NO_ANSWER", // Rang out — the destination never picked up.
  NO_USER_RESPONSE: "NO_ANSWER",
  ORIGINATOR_CANCEL: "NO_ANSWER", // Fonoster gave up before the destination answered.
  USER_BUSY: "BUSY",
  NETWORK_OUT_OF_ORDER: "UNREACHABLE",
  DESTINATION_OUT_OF_ORDER: "UNREACHABLE",
  NO_ROUTE_DESTINATION: "UNREACHABLE",
  UNALLOCATED_NUMBER: "UNREACHABLE",
  SUBSCRIBER_ABSENT: "UNREACHABLE"
};

function deliveryReasonForClearingCause(status: string): DeliveryReason {
  return CLEARING_CAUSE_REASON[status] ?? "PROVIDER_ERROR";
}

export interface ResolveVoiceCallFromCdrDeps {
  tracker: Pick<VoiceCallStatusTracker, "getCallDetail">;
  finalize: (input: {
    providerRef: string;
    answered: boolean;
    /** CDR-clearing-cause-derived reason, present only when `answered` is false. */
    deliveryReason?: DeliveryReason;
    answeredSeconds: number;
    at: string;
  }) => Promise<unknown>;
  /**
   * Poll schedule (ms between attempts). The CDR row is written once, at call end — a
   * lookup before that simply returns nothing — so this schedule is "how long to keep
   * checking for the call to finish", not a propagation-lag buffer. Front-loaded short
   * (catches quick failures like busy/rejected fast) then widening for longer calls;
   * ~2.5 minutes total by default, comfortably past a typical Voz IA conversation.
   */
  pollDelaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_POLL_DELAYS_MS = [3000, 5000, 7000, 10_000, 15_000, 30_000, 30_000, 30_000];

/**
 * Resolves a voice gestión's real outcome from Fonoster's CDR (`Calls.GetCall`) — the
 * sole call-status-tracking mechanism (see `voice-call-status-tracking`). Deliberately
 * not driven by the live `Calls.TrackCall` dial-progress stream: `DialStatus` has no
 * value for "the call ended" (only for whether the dial attempt connected), and
 * Fonoster's own `TrackCall` implementation never closes that stream for a call that
 * connects and later hangs up normally — so it cannot report the one thing this needs.
 *
 * Polls with backoff, starting immediately (no upfront delay): the CDR is written once,
 * at call end, so a lookup simply returns nothing until the call is actually over,
 * whether that's a few seconds or a few minutes away. Always writes a real duration —
 * never a fabricated one for a call the CDR shows as connected. If the poll budget is
 * exhausted before the CDR appears, the gestión is left as-is rather than guessed.
 */
export async function resolveVoiceCallFromCdr(
  deps: ResolveVoiceCallFromCdrDeps,
  providerRef: string,
  at: string
): Promise<void> {
  const delays = deps.pollDelaysMs ?? DEFAULT_POLL_DELAYS_MS;
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let detail = await deps.tracker.getCallDetail(providerRef);
  for (let attempt = 0; !detail && attempt < delays.length; attempt++) {
    await sleep(delays[attempt]);
    detail = await deps.tracker.getCallDetail(providerRef);
  }

  if (!detail) return; // call never ended within the poll budget; a later cycle may still resolve it

  const answered = NORMAL_CLEARING_STATUSES.has(detail.status);
  await deps.finalize({
    providerRef,
    answered,
    deliveryReason: answered ? undefined : deliveryReasonForClearingCause(detail.status),
    answeredSeconds: answered ? detail.durationSeconds : 0,
    at
  });
}
