import { createRequire } from "node:module";
import type { GatherSource, ServerConfig, VoiceRequest, VoiceResponse } from "@fonoster/voice";
import { getLogger } from "@fonoster/logger";
import {
  recordingFileNameForCall,
  type Path,
  type PrerecordedCompletionInput,
  type Outcome
} from "@qcobro/common";
import { config } from "../config.js";

const logger = getLogger({ service: "voice", filePath: import.meta.url });

/** DTMF gather timeout, per the confirmed design decision (5s — long enough to react
 * after the message ends, short enough not to inflate every menu-enabled call). */
const GATHER_TIMEOUT_MS = 5000;
/** Fallback when a template configured `repeatDigit` but omitted `maxRepeats`. */
const DEFAULT_MAX_REPEATS = 2;

export interface PrerecordedCallCompletion extends PrerecordedCompletionInput {
  /** `ENGAGED` when the script played to the end without the caller hanging up early, or
   *  `ANSWERED_BY_MACHINE` when a detected answering machine skipped it entirely (see
   *  `handlePrerecordedCall`). */
  path?: Path;
  /** Set when the caller pressed the opt-out digit specifically. */
  outcome?: Outcome;
  /** How many times the caller replayed the script via the DTMF menu. */
  repeatCount?: number;
}

export interface VoiceServerDeps {
  /**
   * In-process completion sink, invoked when a pre-recorded call ends, whether or not
   * the message played. Best-effort: a throw here MUST NOT break the call. The embedded
   * verb handler only runs when the call is ANSWERED, so this always reports
   * `answered: true`; whether the message actually played is reported separately as
   * `scriptCompleted`, and only the pair means delivery. A call that never reaches this
   * handler at all — never answered, or never even routed to this app — is instead
   * recovered by call-status tracking started at dispatch time (see
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

// TODO(voice-amd-detection): drop this local augmentation once `@fonoster/voice` publishes
// a release including PR #893 and `VoiceRequest.amd` is part of its own types.
type VoiceRequestWithAmd = VoiceRequest & { amd?: { status?: AmdStatus } };

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

/** Fonoster's answering-machine detection verdict on the live call — absent unless AMD
 *  was enabled upstream for this call. Only `MACHINE` changes this function's behavior. */
export type AmdStatus = "HUMAN" | "MACHINE" | "UNKNOWN";

/**
 * Drives one pre-recorded call: answer, then — unless answering-machine detection says
 * `MACHINE` and the template's toggle is on, in which case it hangs up immediately without
 * speaking — play the script, then — only when the dispatched template configured a DTMF
 * menu (`repeatDigit`/`optOutDigit` present in metadata; see `agent-templates`) — play
 * whichever menu message(s) are set and gather a single DTMF digit. Pressing the repeat
 * digit (while under the per-call cap) replays the script and gathers again; pressing the
 * opt-out digit plays the opt-out confirmation message (if configured) and ends the call.
 * Any other digit, or a timed-out gather, hangs up — identical to a template with no menu
 * configured at all. See `prerecorded-audio`.
 *
 * Returns the fields `onCompleted` needs beyond `answeredSeconds`/`providerRef`/`at`, which
 * the caller (the VoiceServer's real Fonoster callback, or a test) attaches itself — kept
 * out of this function so it stays a pure driver over the verb interface, not a clock.
 *
 * `path` is `ANSWERED_BY_MACHINE` when a detected machine skipped the script, or `ENGAGED`
 * on every other normal return: mirrors `decidePath` on the Voz IA side
 * (`decideVoiceOutcome.ts`) — reaching this function's return without a detected machine
 * means the script played to the end (an early hangup mid-`say`/`gather` throws and never
 * reaches it), so the recipient heard the whole message, menu or no menu, press or no
 * press. Only `outcome` stays conditional on an explicit opt-out digit — it is a claim
 * about what the caller did, not just that they listened.
 */
export async function handlePrerecordedCall(
  message: string,
  menu: DtmfMenu | null,
  res: PrerecordedCallVerbs,
  amdStatus?: AmdStatus,
  hangupOnMachineDetected = true
): Promise<{ path?: Path; outcome?: Outcome; repeatCount: number }> {
  await res.answer();

  if (amdStatus === "MACHINE" && hangupOnMachineDetected) {
    await res.hangup();
    return { path: "ANSWERED_BY_MACHINE", outcome: undefined, repeatCount: 0 };
  }

  await res.say(message);

  let path: Path | undefined;
  let outcome: Outcome | undefined;
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
        path = "ENGAGED";
        outcome = "OPT_OUT";
        if (menu.optOutConfirmationMessage) await res.say(menu.optOutConfirmationMessage);
        break;
      }
      if (menu.repeatDigit && digits === menu.repeatDigit) {
        path = "ENGAGED";
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
  return { path: path ?? "ENGAGED", outcome, repeatCount };
}

/**
 * Runs `handlePrerecordedCall` to completion, but never lets a failed verb suppress the
 * completion signal. Hanging up mid-`say`/`gather` — or any verb rejecting because the
 * session died under it — used to propagate straight out of the request handler, skipping
 * `onCompleted` entirely. That left the gestión stuck at `DISPATCHED` until
 * `voiceCompletionTimeoutSweep` swept it 10 minutes later into `FAILED`/`PROVIDER_ERROR`,
 * indistinguishable from a call that never connected.
 *
 * Catching here reports the outcome immediately, and reports it honestly:
 * `scriptCompleted` is `true` only when the script actually played — a call that connected
 * but played nothing (a verb failure, or a detected machine that skipped it) is not
 * recorded as a delivery. Picking up is not the same as being told anything — see
 * `recordPrerecordedOutcome` for how the pair maps to `delivery`. The catch path also
 * records no `path`/`outcome`, since the caller did not necessarily hear the script.
 *
 * `answeredSeconds` is the real elapsed time either way. A call stranded in silence for
 * two minutes was two minutes long; it just was not a delivery.
 */
export async function runPrerecordedCall(
  message: string,
  menu: DtmfMenu | null,
  res: PrerecordedCallVerbs,
  now: () => number = Date.now,
  amdStatus?: AmdStatus,
  hangupOnMachineDetected = true
): Promise<{
  path?: Path;
  outcome?: Outcome;
  repeatCount: number;
  answeredSeconds: number;
  scriptCompleted: boolean;
}> {
  const answeredAt = now();
  try {
    const { path, outcome, repeatCount } = await handlePrerecordedCall(
      message,
      menu,
      res,
      amdStatus,
      hangupOnMachineDetected
    );
    return {
      path,
      outcome,
      repeatCount,
      answeredSeconds: Math.max(0, Math.round((now() - answeredAt) / 1000)),
      // A detected machine reached this return without throwing, but deliberately never
      // heard the script — the one case a clean return is still not a delivery.
      scriptCompleted: path !== "ANSWERED_BY_MACHINE"
    };
  } catch (err) {
    logger.warn(
      `pre-recorded call ended before completion (early hangup?): ${err instanceof Error ? err.message : err}`
    );
    return {
      repeatCount: 0,
      answeredSeconds: Math.max(0, Math.round((now() - answeredAt) / 1000)),
      scriptCompleted: false
    };
  }
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
      const amdStatus = (req as VoiceRequestWithAmd).amd?.status;
      const hangupOnMachineDetected = req.metadata?.hangupOnMachineDetected !== "false";

      logger.verbose(
        `pre-recorded message (appRef=${req.appRef}, callRef=${req.callRef}, menu=${Boolean(menu)}, amd=${amdStatus ?? "n/a"}):`,
        message
      );

      const { path, outcome, repeatCount, answeredSeconds, scriptCompleted } =
        await runPrerecordedCall(message, menu, res, Date.now, amdStatus, hangupOnMachineDetected);

      // Fonoster records the call from its dialplan, under a name built from this same
      // request — so the console can link the audio without us storing a copy. Reported
      // even when the script never played: the recording of a call that connected and
      // played nothing is exactly what an operator needs to hear.
      const recordingFile = recordingFileNameForCall(req.appRef, req.mediaSessionRef);

      // The call was answered — this handler only runs on pickup — but that alone is
      // not a delivery, so `scriptCompleted` rides along to say whether the message
      // actually played. Report in-process so the gestión finalizes and usage settles.
      // Never let a completion failure break the call.
      try {
        deps.onCompleted?.({
          providerRef: req.callRef,
          answered: true,
          scriptCompleted,
          answeredSeconds,
          at: new Date().toISOString(),
          ...(recordingFile ? { recordingFile } : {}),
          ...(path ? { path } : {}),
          ...(outcome ? { outcome } : {}),
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
