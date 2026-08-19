import { getLogger } from "@fonoster/logger";
import type { VoiceCallStatusTracker } from "@qcobro/common";
import { resolveVoiceCallFromCdr } from "./resolveVoiceCallFromCdr.js";

const logger = getLogger({ service: "voice-call-status-tracking", filePath: import.meta.url });

export interface StartVoiceCallStatusTrackingInput {
  tracker: VoiceCallStatusTracker;
  channel: "VOICE_PRERECORDED" | "VOICE_AI";
  providerRef: string;
  now: () => Date;
  finalize: (input: {
    providerRef: string;
    answered: boolean;
    answeredSeconds: number;
    at: string;
  }) => Promise<unknown>;
}

/**
 * Starts call-status tracking for a just-dispatched voice call, fire-and-forget. Called
 * from **every** voice dispatch site — the campaigns engine tick and manual/ad-hoc
 * outreach alike — right after the dispatch-time `DISPATCHED` placeholder gestión is written.
 *
 * Deliberately independent of any channel-specific completion path (the pre-recorded
 * VoiceServer's answer/say/hangup flow; the Voz IA autopilot webhook): those only fire for
 * a call that actually reaches them, which is not guaranteed for every failure mode. This
 * is the one place coverage is guaranteed regardless of how or whether the call ever
 * reaches an app-level handler. Resolution is entirely CDR-based (`resolveVoiceCallFromCdr`)
 * — see `voice-call-status-tracking` design.md for why the live dial-progress stream
 * (`Calls.TrackCall`) cannot do this job.
 */
export function startVoiceCallStatusTracking(input: StartVoiceCallStatusTrackingInput): void {
  const { tracker, channel, providerRef, now, finalize } = input;
  resolveVoiceCallFromCdr({ tracker, finalize }, providerRef, now().toISOString()).catch((err) => {
    logger.error(
      `call-status tracking crashed channel=${channel} providerRef=${providerRef}: ${
        err instanceof Error ? err.message : err
      }`
    );
  });
}
