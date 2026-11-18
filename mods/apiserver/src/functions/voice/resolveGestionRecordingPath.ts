import { getLogger } from "@fonoster/logger";
import type { VoiceCallRecordsClient } from "@qcobro/common";
import { callRecordHasRecording } from "./callRecordTranscript.js";

const logger = getLogger({ service: "gestion-recording", filePath: import.meta.url });

const VOICE_AGENT_TYPES = new Set(["VOICE_AI", "VOICE_PRERECORDED"]);

/**
 * The console path that plays a gestión's recording (`/api/gestiones/<id>/recording`), or
 * null. Only a voice gestión with a `providerRef` can have one, and only when its call record
 * (one lookup) carries a recording the redacted copy doesn't withhold. A record that isn't
 * found, or a failed lookup, is null too: the console then shows its "no recording" panel.
 */
export async function resolveGestionRecordingPath(
  gestion: { id: string; agentType: string; providerRef: string | null },
  callRecords: Pick<VoiceCallRecordsClient, "getRecord"> | null
): Promise<string | null> {
  if (!callRecords || !gestion.providerRef || !VOICE_AGENT_TYPES.has(gestion.agentType)) {
    return null;
  }
  try {
    const record = await callRecords.getRecord(gestion.providerRef);
    return callRecordHasRecording(record) ? `/api/gestiones/${gestion.id}/recording` : null;
  } catch (err) {
    logger.verbose(
      `no call record for gestión ${gestion.id}: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}
