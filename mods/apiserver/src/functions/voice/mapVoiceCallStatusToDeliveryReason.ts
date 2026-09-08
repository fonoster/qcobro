import type { DeliveryReason, VoiceCallStatus } from "@qcobro/common";

/**
 * Fonoster's `CallStatus` (a CDR clearing cause) that this codebase can confidently
 * attribute to one of our `DeliveryReason` values. Every entry here is a status the call
 * has genuinely cleared with — see {@link mapVoiceCallStatusToDeliveryReason} for the one
 * status (`NORMAL_CLEARING`) whose mapped reason is about our own missing signal rather
 * than the call itself, and for the fallback for everything not listed here.
 */
const CALL_STATUS_REASON: Readonly<Partial<Record<VoiceCallStatus, DeliveryReason>>> = {
  NO_ANSWER: "NO_ANSWER",
  NO_USER_RESPONSE: "NO_ANSWER",
  USER_BUSY: "BUSY",
  CALL_REJECTED: "REJECTED",
  NOT_ACCEPTABLE_HERE: "REJECTED",
  UNALLOCATED: "INVALID_DESTINATION",
  INVALID_NUMBER_FORMAT: "INVALID_DESTINATION",
  NO_ROUTE_DESTINATION: "INVALID_DESTINATION",
  SERVICE_UNAVAILABLE: "UNREACHABLE",
  // The call was fine — it connected and cleared normally. What is missing is QCobro's own
  // completion signal, not information about the call itself, so this is not classified as
  // any of the failure reasons above.
  NORMAL_CLEARING: "OUTCOME_UNKNOWN"
};

/**
 * Pure mapper from Fonoster's CDR clearing status to our `DeliveryReason`. Returns `null`
 * for `UNKNOWN` (the CDR's start-only, not-yet-cleared state) and for any status this
 * codebase does not recognize — both mean "not yet decided", never a guess. The voice
 * completion sweep is the only caller: a `null` here means "leave the gestión at
 * DISPATCHED", not "fall back to a generic reason".
 */
export function mapVoiceCallStatusToDeliveryReason(status: VoiceCallStatus): DeliveryReason | null {
  return CALL_STATUS_REASON[status] ?? null;
}
