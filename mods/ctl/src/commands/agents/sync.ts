import { Args } from "@oclif/core";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";

export default class Sync extends AuthenticatedCommand<typeof Sync> {
  static override readonly description =
    "re-attempt an agent template's Fonoster sync and report the resulting status. " +
    "This validates the template's configuration and its sync with Fonoster — it does " +
    "not test conversation behavior (see `agents:eval` for that). Only VOICE_AI " +
    "templates sync with Fonoster; other channel types are a no-op that leaves the " +
    "template unchanged.";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <templateId>"];
  static override readonly args = {
    templateId: Args.string({ description: "the agent template id", required: true })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Sync);
    const client = await this.createSdkClient();

    try {
      await client.agentTemplates.sync({ id: args.templateId });
    } catch (err) {
      this.error(`Sync failed: ${err instanceof Error ? err.message : String(err)}`, { exit: 1 });
    }

    // `sync` doesn't echo the updated config, so re-fetch to report the
    // resulting status — `get` includes each channel's child config.
    const template = await client.agentTemplates.get({ id: args.templateId });
    const voiceConfig = (template as { voiceAiConfig?: { fonosterAppRef?: string | null } })
      .voiceAiConfig;

    if (template.type !== "VOICE_AI") {
      this.log(`${template.id} is type ${template.type}; sync is a no-op for non-voice templates.`);
      return;
    }

    if (voiceConfig?.fonosterAppRef) {
      this.log(`Synced: ${template.id} → fonosterAppRef=${voiceConfig.fonosterAppRef}`);
    } else {
      this.log(`Not synced: ${template.id} has no fonosterAppRef after the sync attempt.`);
    }
  }
}
