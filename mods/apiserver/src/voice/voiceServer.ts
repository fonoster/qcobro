import { createRequire } from "node:module";
import type { GatherSource, ServerConfig, VoiceRequest, VoiceResponse } from "@fonoster/voice";
import { getLogger } from "@fonoster/logger";
import type { Camino, PrerecordedCompletionInput, Resultado } from "@qcobro/common";
import { config } from "../config.js";

const logger = getLogger({ service: "voice", filePath: import.meta.url });

/** DTMF gather timeout, per the confirmed design decision (5s — long enough to react
 * after the message ends, short enough not to inflate every menu-enabled call). */
const GATHER_TIMEOUT_MS = 5000;
/** Fallback when a template configured `repeatDigit` but omitted `maxRepeats`. */
const DEFAULT_MAX_REPEATS = 2;

export interface PrerecordedCallCompletion extends PrerecordedCompletionInput {
  /** Set when the caller pressed any configured DTMF digit (repeat or opt-out). */
  camino?: Camino;
  /** Set when the caller pressed the opt-out digit specifically. */
  resultado?: Resultado;
  /** How many times the caller replayed the script via the DTMF menu. */
  repeatCount?: number;
}

export interface VoiceServerDeps {
  /**
   * In-process completion sink, invoked when a pre-recorded call finishes playing.
   * Best-effort: a throw here MUST NOT break the call. The embedded verb handler only
   * runs when the call is ANSWERED, so this reports `answered: true`. A call that never
   * reaches this handler at all — never answered, or never even routed to this app — is
   * instead recovered by call-status tracking started at dispatch time (see
   * `startVoiceCallStatusTracking`, wired at the dispatch sites, not here).
   */
  onCompleted?: (completion: PrerecordedCallCompletion) => void;
}

// `@fonoster/voice` is CJS exposing the server as its `default` export. Under the
// project's ESM runtime (tsx) the namespace interop double-wraps it, so resolve the
// constructor via createRequire — unambiguous at runtime, typed below.
type VoiceServerCtor = new (config?: ServerConfig) => {
  listen: (handler: (req: VoiceRequest, res: VoiceResponse) => Promise<void>) => Promise<void>;
};
const VoiceServer = createRequire(import.meta.url)("@fonoster/voice").default as VoiceServerCtor;

export interface DtmfMenu {
  repeatDigit?: string;
  repeatMessage?: string;
  maxRepeats: number;
  optOutDigit?: string;
  optOutMessage?: string;
  /** Played once the opt-out digit is detected, before hangup — closes the interaction out
   * for the caller instead of just ending the call with no acknowledgment. */
  optOutConfirmationMessage?: string;
}

export function readDtmfMenu(metadata: Record<string, string> | undefined): DtmfMenu | null {
  const repeatDigit = metadata?.repeatDigit || undefined;
  const optOutDigit = metadata?.optOutDigit || undefined;
  if (!repeatDigit && !optOutDigit) return null;

  const parsedMaxRepeats = metadata?.maxRepeats ? Number.parseInt(metadata.maxRepeats, 10) : NaN;
  return {
    repeatDigit,
    repeatMessage: metadata?.repeatMessage || undefined,
    maxRepeats: Number.isFinite(parsedMaxRepeats) ? parsedMaxRepeats : DEFAULT_MAX_REPEATS,
    optOutDigit,
    optOutMessage: metadata?.optOutMessage || undefined,
    optOutConfirmationMessage: metadata?.optOutConfirmationMessage || undefined
  };
}

/** The subset of `VoiceResponse` the DTMF flow drives — narrowed for testability. */
export interface PrerecordedCallVerbs {
  answer(): Promise<unknown>;
  say(text: string): Promise<unknown>;
  hangup(): Promise<unknown>;
  gather(options: {
    source: GatherSource;
    maxDigits: number;
    timeout: number;
  }): Promise<{ digits?: string }>;
}

/**
 * Drives one pre-recorded call: answer, play the script, then — only when the dispatched
 * template configured a DTMF menu (`repeatDigit`/`optOutDigit` present in metadata; see
 * `agent-templates`) — play whichever menu message(s) are set and gather a single DTMF
 * digit. Pressing the repeat digit (while under the per-call cap) replays the script and
 * gathers again; pressing the opt-out digit plays the opt-out confirmation message (if
 * configured) and ends the call. Any other digit, or a timed-out gather, hangs up —
 * identical to a template with no menu configured at all. See `prerecorded-audio`.
 *
 * Returns the fields `onCompleted` needs beyond `answeredSeconds`/`providerRef`/`at`, which
 * the caller (the VoiceServer's real Fonoster callback, or a test) attaches itself — kept
 * out of this function so it stays a pure driver over the verb interface, not a clock.
 */
export async function handlePrerecordedCall(
  message: string,
  menu: DtmfMenu | null,
  res: PrerecordedCallVerbs
): Promise<{ camino?: Camino; resultado?: Resultado; repeatCount: number }> {
  await res.answer();
  await res.say(message);

  let camino: Camino | undefined;
  let resultado: Resultado | undefined;
  let repeatCount = 0;

  if (menu) {
    if (menu.repeatMessage) await res.say(menu.repeatMessage);
    if (menu.optOutMessage) await res.say(menu.optOutMessage);

    for (;;) {
      // `"dtmf"` matches `GatherSource.DTMF`'s runtime value; imported as a type only
      // (like the rest of this file) to avoid the CJS/ESM named-export interop that
      // `createRequire` works around for the default export just below.
      const { digits } = await res.gather({
        source: "dtmf" as GatherSource,
        maxDigits: 1,
        timeout: GATHER_TIMEOUT_MS
      });

      if (menu.optOutDigit && digits === menu.optOutDigit) {
        camino = "ENGAGED";
        resultado = "OPT_OUT";
        if (menu.optOutConfirmationMessage) await res.say(menu.optOutConfirmationMessage);
        break;
      }
      if (menu.repeatDigit && digits === menu.repeatDigit) {
        camino = "ENGAGED";
        if (repeatCount >= menu.maxRepeats) break; // cap reached — hang up like an unrecognized digit
        repeatCount += 1;
        await res.say(message);
        continue;
      }
      // Unrecognized digit, or the gather timed out with none (`digits` empty/undefined).
      break;
    }
  }

  await res.hangup();
  return { camino, resultado, repeatCount };
}

/**
 * Embedded Fonoster VoiceServer for PRE-RECORDED voice agents.
 *
 * Unlike Voz IA (AUTOPILOT apps that live inside Fonoster), pre-recorded agents
 * are EXTERNAL Fonoster applications: when a pre-recorded call connects, Fonoster
 * calls back into this server. We read the rendered script from the call
 * `metadata` (set at dispatch time) and play it with the Say verb, then drive the
 * optional DTMF menu via {@link handlePrerecordedCall}.
 */
export function startVoiceServer(deps: VoiceServerDeps = {}): void {
  const port = config.apiserver.voicePort;

  new VoiceServer({ port, skipIdentity: true }).listen(
    async (req: VoiceRequest, res: VoiceResponse) => {
      const message = req.metadata?.message ?? "";
      const menu = readDtmfMenu(req.metadata);

      logger.verbose(
        `pre-recorded message (appRef=${req.appRef}, callRef=${req.callRef}, menu=${Boolean(menu)}):`,
        message
      );

      const answeredAt = Date.now();
      const { camino, resultado, repeatCount } = await handlePrerecordedCall(message, menu, res);

      // The call was answered (this handler only runs on pickup): report the
      // answered duration in-process so the gestión records DELIVERED + duration
      // and usage settles. Never let a completion failure break the call.
      const answeredSeconds = Math.max(0, Math.round((Date.now() - answeredAt) / 1000));
      try {
        deps.onCompleted?.({
          providerRef: req.callRef,
          answered: true,
          answeredSeconds,
          at: new Date().toISOString(),
          ...(camino ? { camino } : {}),
          ...(resultado ? { resultado } : {}),
          ...(repeatCount > 0 ? { repeatCount } : {})
        });
      } catch (err) {
        logger.error(
          `pre-recorded completion sink failed (callRef=${req.callRef}):`,
          err instanceof Error ? err.message : err
        );
      }
    }
  );

  logger.verbose(`Voice server running on port ${port}`);
}
