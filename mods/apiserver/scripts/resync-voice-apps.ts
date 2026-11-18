/**
 * Re-syncs every VOICE_AI template's Fonoster app to the current Autopilot format, keeping
 * each app's ref. Run it once after deploying a change to the app shape:
 *
 *   npm run voice:resync --workspace=mods/apiserver
 *
 * Exits 1 when any template failed (each is printed as `failed <templateId> <name>: …`).
 * Running it again is safe.
 */
import { config } from "../src/config.js";
import { prisma } from "../src/db.js";
import { FonosterVoiceApplicationClient } from "../src/services/fonosterVoiceApplicationClient.js";
import { createResyncVoiceAiTemplates } from "../src/functions/agentTemplates/resyncVoiceAiTemplates.js";

async function main(): Promise<number> {
  if (!config.fonoster) {
    console.error("No fonoster section in qcobro.json; nothing to re-sync.");
    return 1;
  }
  const resync = createResyncVoiceAiTemplates({
    client: prisma as never,
    voiceApplications: new FonosterVoiceApplicationClient(config.fonoster),
    log: (line) => console.log(line)
  });
  const { failed } = await resync();
  return failed > 0 ? 1 : 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });
