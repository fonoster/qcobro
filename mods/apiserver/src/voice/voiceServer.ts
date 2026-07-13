import { createRequire } from "node:module";
import type { ServerConfig, VoiceRequest, VoiceResponse } from "@fonoster/voice";
import { getLogger } from "@fonoster/logger";
import type { PrerecordedCompletionInput } from "@qcobro/common";
import { config } from "../config.js";

const logger = getLogger({ service: "voice", filePath: import.meta.url });

export interface VoiceServerDeps {
  /**
   * In-process completion sink, invoked when a pre-recorded call finishes playing.
   * Best-effort: a throw here MUST NOT break the call. The embedded verb handler only
   * runs when the call is ANSWERED, so this reports `answered: true`; detecting a call
   * that never picked up needs a separate Fonoster call-status signal.
   */
  onCompleted?: (completion: PrerecordedCompletionInput) => void;
}

// `@fonoster/voice` is CJS exposing the server as its `default` export. Under the
// project's ESM runtime (tsx) the namespace interop double-wraps it, so resolve the
// constructor via createRequire — unambiguous at runtime, typed below.
type VoiceServerCtor = new (config?: ServerConfig) => {
  listen: (handler: (req: VoiceRequest, res: VoiceResponse) => Promise<void>) => Promise<void>;
};
const VoiceServer = createRequire(import.meta.url)("@fonoster/voice").default as VoiceServerCtor;

/**
 * Embedded Fonoster VoiceServer for PRE-RECORDED voice agents.
 *
 * Unlike Voz IA (AUTOPILOT apps that live inside Fonoster), pre-recorded agents
 * are EXTERNAL Fonoster applications: when a pre-recorded call connects, Fonoster
 * calls back into this server. We read the rendered script from the call
 * `metadata` (set at dispatch time) and play it with the Say verb.
 *
 * For now the message is only logged — actual playback/voice selection is wired
 * later. The string is prepared exactly as it would be handed to `say`.
 */
export function startVoiceServer(deps: VoiceServerDeps = {}): void {
  const port = config.apiserver.voicePort;

  new VoiceServer({ port, skipIdentity: true }).listen(
    async (req: VoiceRequest, res: VoiceResponse) => {
      const message = req.metadata?.message ?? "";

      logger.verbose(
        `pre-recorded message (appRef=${req.appRef}, callRef=${req.callRef}):`,
        message
      );

      await res.answer();
      const answeredAt = Date.now();
      await res.say(message);
      await res.hangup();

      // The call was answered (this handler only runs on pickup): report the
      // answered duration in-process so the gestión records DELIVERED + duration
      // and usage settles. Never let a completion failure break the call.
      const answeredSeconds = Math.max(0, Math.round((Date.now() - answeredAt) / 1000));
      try {
        deps.onCompleted?.({
          providerRef: req.callRef,
          answered: true,
          answeredSeconds,
          at: new Date().toISOString()
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
