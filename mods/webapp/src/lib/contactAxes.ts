import { channelCanEngage } from "@qcobro/common";
import type { useI18n } from "./i18n.js";

type Translate = ReturnType<typeof useI18n>["t"];
type Key = Parameters<Translate>[0];

/** Dynamic i18n keys are built from enum values, which the key union cannot express. */
const key = (value: string) => value as Key;

export const ENTREGAS = ["DISPATCHED", "DELIVERED", "FAILED"] as const;

export const RESULTADOS = [
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
function entregaWord(t: Translate, entrega: string, agentType: string): string {
  if (entrega === "DELIVERED" && VOICE_CHANNELS.has(agentType)) {
    return t(key("gestiones.entrega.voice.DELIVERED"));
  }
  return t(key(`gestiones.entrega.${entrega}`));
}

/**
 * The delivery state, with the failure reason appended after a middot: `Fallido · Sin
 * respuesta`. The reason is what makes a failure actionable, and on the one-way channels it is
 * most of what there is to say about the attempt, so it earns its place inline rather than in
 * a field of its own.
 */
export function entregaLabel(
  t: Translate,
  entrega: string,
  deliveryReason: string | null | undefined,
  agentType: string
): string {
  const word = entregaWord(t, entrega, agentType);
  if (entrega !== "FAILED" || !deliveryReason) return word;
  return `${word} · ${t(key(`gestiones.deliveryReason.${deliveryReason}`))}`;
}

/** `ENGAGED` is a conversation on a call and a reply on a thread. */
function caminoWord(t: Translate, camino: string, agentType: string): string {
  if (camino === "ENGAGED" && THREADED_CHANNELS.has(agentType)) {
    return t(key("gestiones.camino.threaded.ENGAGED"));
  }
  return t(key(`gestiones.camino.${camino}`));
}

/**
 * The interaction as an arrow-joined progression of the stages actually reached, always
 * starting from dispatch. Returns null on `SMS`, which has no inbound path at all. Also
 * returns null whenever there is nothing to describe — which, for every channel except
 * `VOICE_PRERECORDED`, is implied by `channelCanEngage`; `VOICE_PRERECORDED` gets its own
 * check just below because its DTMF menu can produce a real `camino: ENGAGED` even though
 * `channelCanEngage` (a channel-fixed check) says it can't — see `account-contact-log`.
 *
 * `Leído` is a display-only stage taken from `channelData.openedAt`; read-but-unengaged is
 * deliberately not modelled as a `camino` value, so it appears here and in no metric.
 */
export function caminoPath(
  t: Translate,
  agentType: string,
  camino: string | null | undefined,
  channelData?: Record<string, unknown> | null
): string | null {
  if (agentType === "SMS") return null;
  if (!channelCanEngage(agentType) && agentType !== "VOICE_PRERECORDED") return null;
  if (!camino && !channelData?.openedAt) return null;

  const stages = [t(key("gestiones.entrega.DISPATCHED"))];
  if (THREADED_CHANNELS.has(agentType) && channelData?.openedAt) {
    stages.push(t(key("gestiones.camino.read")));
  }
  if (camino) stages.push(caminoWord(t, camino, agentType));
  return stages.join(" → ");
}

export function resultadoLabel(t: Translate, resultado: string | null | undefined): string | null {
  return resultado ? t(key(`gestiones.resultado.${resultado}`)) : null;
}
