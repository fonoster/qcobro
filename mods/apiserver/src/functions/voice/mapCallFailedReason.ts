import type { DeliveryReason } from "@qcobro/common";

/** Fonoster's `call.failed` reasons QCobro can attribute to a specific delivery reason. */
const CALL_FAILED_REASON: Readonly<Record<string, DeliveryReason>> = {
  busy: "BUSY",
  no_answer: "NO_ANSWER",
  rejected: "REJECTED",
  app_unreachable: "PROVIDER_ERROR",
  node_error: "PROVIDER_ERROR"
};

/**
 * Maps a `call.failed` webhook's `reason` to the gestión's `deliveryReason`. Unlike
 * {@link mapVoiceCallStatusToDeliveryReason}, this never returns null: a `call.failed` is
 * final, so `removed` and any reason Fonoster adds later become `OUTCOME_UNKNOWN` and the
 * gestión is never left DISPATCHED.
 */
export function mapCallFailedReason(reason: string): DeliveryReason {
  return Object.hasOwn(CALL_FAILED_REASON, reason) ? CALL_FAILED_REASON[reason] : "OUTCOME_UNKNOWN";
}
