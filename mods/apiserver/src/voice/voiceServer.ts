import { createRequire } from "node:module";
import type { ServerConfig, VoiceRequest, VoiceResponse } from "@fonoster/voice";
import { config } from "../config.js";

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
export function startVoiceServer(): void {
  const port = config.apiserver.voicePort;

  new VoiceServer({ port, skipIdentity: true }).listen(
    async (req: VoiceRequest, res: VoiceResponse) => {
      const message = req.metadata?.message ?? "";

      console.log(
        `[voice] pre-recorded message (appRef=${req.appRef}, callRef=${req.callRef}):`,
        message
      );

      await res.answer();
      await res.say(message);
      await res.hangup();
    }
  );

  console.log(`Voice server running on port ${port}`);
}
