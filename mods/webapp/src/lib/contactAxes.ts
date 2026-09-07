import { channelCanEngage } from "@qcobro/common";
import type { useI18n } from "./i18n.js";

type Translate = ReturnType<typeof useI18n>["t"];
type Key = Parameters<Translate>[0];

/** Dynamic i18n keys are built from enum values, which the key union cannot express. */
const key = (value: string) => value as Key;

export const DELIVERIES = ["DISPATCHED", "DELIVERED", "FAILED"] as const;

export const OUTCOMES = [
  "PAYMENT_PROMISE",
  "NEW_TERMS",
  "PAID",
  "CALLBACK_REQUESTED",
  "DISPUTE_RAISED",
  "INFORMATION_REQUEST",
  "REFUSED",
  "OPT_OUT",
  "WRONG_PARTY",
  "RESOLVED"
] as const;

const VOICE_CHANNELS = new Set(["VOICE_AI", "VOICE_PRERECORDED"]);
const THREADED_CHANNELS = new Set(["EMAIL", "WHATSAPP"]);

/**
 * `DELIVERED` reads differently per channel — a call connects, a message is delivered — so the
 * voice channels get their own label for the same enum value.
 */
function deliveryWord(t: Translate, delivery: string, agentType: string): string {
  if (delivery === "DELIVERED" && VOICE_CHANNELS.has(agentType)) {
    return t(key("gestiones.delivery.voice.DELIVERED"));
  }
  return t(key(`gestiones.delivery.${delivery}`));
}

/**
 * The delivery state, with the failure reason appended after a middot: `Fallido · Sin
 * respuesta`. The reason is what makes a failure actionable, and on the one-way channels it is
 * most of what there is to say about the attempt, so it earns its place inline rather than in
 * a field of its own.
 */
export function deliveryLabel(
  t: Translate,
  delivery: string,
  deliveryReason: string | null | undefined,
  agentType: string
): string {
  const word = deliveryWord(t, delivery, agentType);
  if (delivery !== "FAILED" || !deliveryReason) return word;
  return `${word} · ${t(key(`gestiones.deliveryReason.${deliveryReason}`))}`;
}

/** `ENGAGED` is a conversation on a call and a reply on a thread. */
function pathWord(t: Translate, path: string, agentType: string): string {
  if (path === "ENGAGED" && THREADED_CHANNELS.has(agentType)) {
    return t(key("gestiones.path.threaded.ENGAGED"));
  }
  return t(key(`gestiones.path.${path}`));
}

/**
 * The interaction as an arrow-joined progression of the stages actually reached, always
 * starting from dispatch. Returns null on `SMS`, which has no inbound path at all. Also
 * returns null whenever there is nothing to describe — which, for every channel except
 * `VOICE_PRERECORDED`, is implied by `channelCanEngage`; `VOICE_PRERECORDED` gets its own
 * check just below because its DTMF menu can produce a real `path: ENGAGED` even though
 * `channelCanEngage` (a channel-fixed check) says it can't — see `account-contact-log`.
 *
 * `Leído` is a display-only stage taken from `channelData.openedAt`; read-but-unengaged is
 * deliberately not modelled as a `path` value, so it appears here and in no metric.
 */
export function pathProgression(
  t: Translate,
  agentType: string,
  path: string | null | undefined,
  channelData?: Record<string, unknown> | null
): string | null {
  if (agentType === "SMS") return null;
  if (!channelCanEngage(agentType) && agentType !== "VOICE_PRERECORDED") return null;
  if (!path && !channelData?.openedAt) return null;

  const stages = [t(key("gestiones.delivery.DISPATCHED"))];
  if (THREADED_CHANNELS.has(agentType) && channelData?.openedAt) {
    stages.push(t(key("gestiones.path.read")));
  }
  if (path) stages.push(pathWord(t, path, agentType));
  return stages.join(" → ");
}

export function outcomeLabel(t: Translate, outcome: string | null | undefined): string | null {
  return outcome ? t(key(`gestiones.outcome.${outcome}`)) : null;
}
