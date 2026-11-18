import { VoiceServer } from "@fonoster/voice";
import { getLogger } from "@fonoster/logger";
import type { Path, PrerecordedCompletionInput, Outcome } from "@qcobro/common";
import { config } from "../config.js";

const logger = getLogger({ service: "voice", filePath: import.meta.url });

/** DTMF gather timeout, per the confirmed design decision (5s — long enough to react
 * after the message ends, short enough not to inflate every menu-enabled call). */
const GATHER_TIMEOUT_MS = 5000;
/** Fallback when a template configured `repeatDigit` but omitted `maxRepeats`. */
const DEFAULT_MAX_REPEATS = 2;
/**
 * How long, from session start, the handler waits for the app's answering-machine verdict
 * before speaking: the app's worst case (4000 ms waiting for speech + the 2000 ms window +
 * 1500 ms grace + classification). No verdict by then plays the script.
 */
export const AMD_WAIT_MS = 9000;
/** `amd.result` statuses that count as a machine: nothing of the script is left on one. */
const MACHINE_STATUSES = new Set(["voicemail", "machine", "ivr"]);
/** The path AppBridge opens pre-recorded sessions on (the app URL's path, through Envoy). */
const SESSION_PATH = "/voice/session";

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

/** Reads one call-metadata value as a string (dispatch sends strings; empty means unset). */
function text(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return value === undefined || value === null || value === "" ? undefined : String(value);
}

export function readDtmfMenu(metadata: Record<string, unknown> | undefined): DtmfMenu | null {
  const repeatDigit = text(metadata, "repeatDigit");
  const optOutDigit = text(metadata, "optOutDigit");
  if (!repeatDigit && !optOutDigit) return null;

  const rawMaxRepeats = text(metadata, "maxRepeats");
  const parsedMaxRepeats = rawMaxRepeats ? Number.parseInt(rawMaxRepeats, 10) : NaN;
  return {
    repeatDigit,
    repeatMessage: text(metadata, "repeatMessage"),
    maxRepeats: Number.isFinite(parsedMaxRepeats) ? parsedMaxRepeats : DEFAULT_MAX_REPEATS,
    optOutDigit,
    optOutMessage: text(metadata, "optOutMessage"),
    optOutConfirmationMessage: text(metadata, "optOutConfirmationMessage")
  };
}

type SessionEvent = "amd.result" | "end";
type SessionEventListener = (data: { status?: string; reason?: string }) => void;

/** The subset of `@fonoster/voice`'s `Session` the pre-recorded flow drives — narrowed for
 * testability. Verbs reject once the session has ended (the callee hung up). */
export interface PrerecordedSession {
  readonly metadata: Record<string, unknown>;
  say(text: string, options: { interruptible: boolean }): Promise<{ interrupted: boolean }>;
  gather(options: {
    source: "dtmf";
    maxDigits: number;
    timeout: number;
  }): Promise<{ digits?: string }>;
  hangup(): Promise<void>;
  on(event: SessionEvent, cb: SessionEventListener): unknown;
  off(event: SessionEvent, cb: SessionEventListener): unknown;
}

/**
 * Waits for the app's answering-machine verdict, the session's end, or the deadline
 * (`AMD_WAIT_MS` from `startedAt`), whichever comes first. Resolves with the verdict's
 * status, or undefined when there was none.
 */
function waitForAmdVerdict(
  session: PrerecordedSession,
  startedAt: number
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const done = (status?: string) => {
      clearTimeout(timer);
      session.off("amd.result", onVerdict);
      session.off("end", onEnd);
      resolve(status);
    };
    const onVerdict: SessionEventListener = (data) => done(data.status);
    const onEnd: SessionEventListener = () => done();
    const timer = setTimeout(done, Math.max(0, startedAt + AMD_WAIT_MS - Date.now()));
    session.on("amd.result", onVerdict);
    session.on("end", onEnd);
  });
}

/**
 * Drives one pre-recorded call session. With the template's `hangupOnMachineDetected` on
 * (the default), it first waits for the app's answering-machine verdict (see
 * `waitForAmdVerdict`): `voicemail`, `machine` or `ivr` hangs up without speaking. Otherwise
 * it speaks the script from `session.metadata.message`, non-interruptibly so a callee's "aló"
 * never cuts it, then — only when the dispatched template configured a DTMF menu
 * (`repeatDigit`/`optOutDigit` in metadata; see `agent-templates`) — plays the menu
 * message(s) and gathers a single DTMF digit. The repeat digit (under the per-call cap)
 * replays the script and gathers again; the opt-out digit plays the confirmation (if
 * configured) and ends the call. Any other digit, or a timed-out gather, hangs up. See
 * `prerecorded-audio`.
 *
 * `scriptCompleted` is true only when the script's last `say` returned without being
 * interrupted. A session that ends mid-verb rejects out of here; `runPrerecordedCall`
 * reports that case.
 */
export async function handlePrerecordedCall(
  session: PrerecordedSession,
  startedAt: number = Date.now()
): Promise<{ path?: Path; outcome?: Outcome; repeatCount: number; scriptCompleted: boolean }> {
  const message = text(session.metadata, "message") ?? "";
  const menu = readDtmfMenu(session.metadata);
  const hangupOnMachineDetected = text(session.metadata, "hangupOnMachineDetected") !== "false";

  if (hangupOnMachineDetected) {
    const verdict = await waitForAmdVerdict(session, startedAt);
    if (verdict && MACHINE_STATUSES.has(verdict)) {
      await session.hangup();
      return {
        path: "ANSWERED_BY_MACHINE",
        outcome: undefined,
        repeatCount: 0,
        scriptCompleted: false
      };
    }
  }

  const say = (line: string) => session.say(line, { interruptible: false });
  let scriptCompleted = !(await say(message)).interrupted;

  let outcome: Outcome | undefined;
  let repeatCount = 0;

  if (menu) {
    if (menu.repeatMessage) await say(menu.repeatMessage);
    if (menu.optOutMessage) await say(menu.optOutMessage);

    for (;;) {
      const { digits } = await session.gather({
        source: "dtmf",
        maxDigits: 1,
        timeout: GATHER_TIMEOUT_MS
      });

      if (menu.optOutDigit && digits === menu.optOutDigit) {
        outcome = "OPT_OUT";
        if (menu.optOutConfirmationMessage) await say(menu.optOutConfirmationMessage);
        break;
      }
      if (menu.repeatDigit && digits === menu.repeatDigit) {
        if (repeatCount >= menu.maxRepeats) break; // cap reached — hang up like an unrecognized digit
        repeatCount += 1;
        scriptCompleted = !(await say(message)).interrupted;
        continue;
      }
      // Unrecognized digit, or the gather timed out with none (`digits` empty/undefined).
      break;
    }
  }

  await session.hangup();
  return { path: "ENGAGED", outcome, repeatCount, scriptCompleted };
}

/**
 * Runs `handlePrerecordedCall` to completion, but never lets a failed verb suppress the
 * completion signal: a session that ends mid-`say`/`gather` (the callee hung up) rejects the
 * pending verb, and is reported here with `scriptCompleted: false`, no `path`/`outcome`, and
 * the real elapsed seconds. Picking up is not the same as being told anything — see
 * `recordPrerecordedOutcome` for how the pair maps to `delivery`.
 */
export async function runPrerecordedCall(
  session: PrerecordedSession,
  now: () => number = Date.now
): Promise<{
  path?: Path;
  outcome?: Outcome;
  repeatCount: number;
  answeredSeconds: number;
  scriptCompleted: boolean;
}> {
  const answeredAt = now();
  const elapsed = () => Math.max(0, Math.round((now() - answeredAt) / 1000));
  try {
    const result = await handlePrerecordedCall(session);
    return { ...result, answeredSeconds: elapsed() };
  } catch (err) {
    logger.warn(
      `pre-recorded call ended before completion (early hangup?): ${err instanceof Error ? err.message : err}`
    );
    return { repeatCount: 0, answeredSeconds: elapsed(), scriptCompleted: false };
  }
}

export interface VoiceServerDeps {
  /**
   * In-process completion sink, invoked when a pre-recorded session ends, whether or not
   * the message played. Best-effort: a throw here MUST NOT break the call. AppBridge opens
   * a session only once the call is answered, so this always reports `answered: true`;
   * whether the message actually played is reported separately as `scriptCompleted`.
   */
  onCompleted?: (completion: PrerecordedCallCompletion) => void;
  /** The `fonoster` section of `qcobro.json` (default: the loaded config). */
  fonoster?: { prerecordedAppUrl?: string; prerecordedSigningSecret?: string };
  /** Port to listen on (default: `apiserver.voicePort`). */
  port?: number;
  /** Where the disabled notice goes (default: the logger). */
  log?: (line: string) => void;
}

/**
 * Starts the voice server for PRE-RECORDED agents: Fonoster's AppBridge opens one signed
 * WebSocket session per answered call to the STREAM app at `fonoster.prerecordedAppUrl`
 * (through Envoy, `wss://<host>/voice/session`). The rendered script and DTMF menu arrive as
 * call metadata (set at dispatch time). Only connections signed with
 * `fonoster.prerecordedSigningSecret` are accepted; the signature covers the app URL exactly
 * as configured, since Envoy rewrites the host and scheme.
 *
 * Without both keys the server does not start (resolves null) and the apiserver boots
 * normally.
 */
export async function startVoiceServer(deps: VoiceServerDeps = {}): Promise<VoiceServer | null> {
  const fonoster = deps.fonoster ?? config.fonoster;
  const log = deps.log ?? ((line: string) => logger.warn(line));
  const publicUrl = fonoster?.prerecordedAppUrl;
  const signingSecret = fonoster?.prerecordedSigningSecret;
  if (!publicUrl || !signingSecret) {
    log(
      "pre-recorded voice server disabled: set fonoster.prerecordedAppUrl and fonoster.prerecordedSigningSecret"
    );
    return null;
  }

  const port = deps.port ?? config.apiserver.voicePort;
  const server = new VoiceServer({ port, path: SESSION_PATH, signingSecret, publicUrl });
  await server.listen(async (session) => {
    logger.verbose(
      `pre-recorded session (appRef=${session.appRef}, callRef=${session.callRef}):`,
      session.metadata.message
    );

    const { path, outcome, repeatCount, answeredSeconds, scriptCompleted } =
      await runPrerecordedCall(session as PrerecordedSession);

    // Report in-process so the gestión finalizes and usage settles. The recording comes
    // from the call record (see the voice webhook receiver). Never let a completion
    // failure break the call.
    try {
      deps.onCompleted?.({
        providerRef: session.callRef,
        answered: true,
        scriptCompleted,
        answeredSeconds,
        at: new Date().toISOString(),
        ...(path ? { path } : {}),
        ...(outcome ? { outcome } : {}),
        ...(repeatCount > 0 ? { repeatCount } : {})
      });
    } catch (err) {
      logger.error(
        `pre-recorded completion sink failed (callRef=${session.callRef}):`,
        err instanceof Error ? err.message : err
      );
    }
  });

  logger.verbose(`pre-recorded voice server listening on port ${server.port}${SESSION_PATH}`);
  return server;
}
