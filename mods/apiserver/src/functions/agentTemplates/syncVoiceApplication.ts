import type { AgentTemplateClient, VoiceApplicationClient } from "@qcobro/common";

/**
 * Sync a VOICE_AI template's child config to its Fonoster Autopilot application:
 * create the app on first sync, update it thereafter, and persist the returned
 * `fonosterAppRef`. Returns the ref, or null when the template has no voice config.
 *
 * Throws if the provider call fails — callers decide whether that is fatal
 * (manual re-sync surfaces the error) or best-effort (create/update save locally).
 */
export async function syncVoiceAiApplication(
  client: AgentTemplateClient,
  voiceApplications: VoiceApplicationClient,
  templateId: string
): Promise<string | null> {
  const cfg = await client.voiceAiConfig.findUnique({ where: { templateId } });
  if (!cfg) return null;

  const input = {
    name: cfg.fonosterAppName,
    voice: cfg.voice,
    systemPrompt: cfg.systemPrompt,
    firstMessage: cfg.firstMessage,
    language: cfg.language
  };

  const { ref } = cfg.fonosterAppRef
    ? await voiceApplications.updateApplication(cfg.fonosterAppRef, input)
    : await voiceApplications.createApplication(input);

  await client.voiceAiConfig.update({ where: { templateId }, data: { fonosterAppRef: ref } });
  return ref;
}
