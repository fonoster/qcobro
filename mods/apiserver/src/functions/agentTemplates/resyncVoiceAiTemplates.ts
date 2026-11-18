import type { AgentTemplateClient, VoiceApplicationClient } from "@qcobro/common";
import { syncVoiceAiApplication } from "./syncVoiceApplication.js";

/** The VOICE_AI templates that already have a Fonoster app. */
export interface ResyncVoiceAiClient {
  voiceAiConfig: {
    findMany(args: {
      where: { fonosterAppRef: { not: null } };
      select: { templateId: true; template: { select: { name: true } } };
      orderBy: { templateId: "asc" };
    }): Promise<{ templateId: string; template: { name: string } }[]>;
  };
}

export interface ResyncVoiceAiTemplatesDeps {
  client: AgentTemplateClient & ResyncVoiceAiClient;
  voiceApplications: VoiceApplicationClient;
  log: (line: string) => void;
}

/**
 * Re-syncs every VOICE_AI template that has a Fonoster app, updating the app in place (its
 * ref is kept), so apps created in the retired Autopilot format take the current one. Prints
 * `failed <templateId> <name>: <error>` for each failure and keeps going, then
 * `resynced <n> VOICE_AI templates, <m> failed`. Running it again is safe: an update
 * replaces the whole app.
 */
export function createResyncVoiceAiTemplates(deps: ResyncVoiceAiTemplatesDeps) {
  return async (): Promise<{ resynced: number; failed: number }> => {
    const templates = await deps.client.voiceAiConfig.findMany({
      where: { fonosterAppRef: { not: null } },
      select: { templateId: true, template: { select: { name: true } } },
      orderBy: { templateId: "asc" }
    });

    let resynced = 0;
    let failed = 0;
    for (const { templateId, template } of templates) {
      try {
        await syncVoiceAiApplication(deps.client, deps.voiceApplications, templateId);
        resynced++;
      } catch (err) {
        failed++;
        deps.log(
          `failed ${templateId} ${template.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    deps.log(`resynced ${resynced} VOICE_AI templates, ${failed} failed`);
    return { resynced, failed };
  };
}
