import { readFileSync } from "node:fs";
import { Flags } from "@oclif/core";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";

export default class Preview extends AuthenticatedCommand<typeof Preview> {
  static override readonly description =
    "render an SMS/VOICE_PRERECORDED agent template's message body or script against a " +
    "sample account — no conversation, no streaming. Accepts an existing template id or a " +
    "standalone YAML definition. For VOICE_AI/EMAIL/WHATSAPP, use `agents:eval` instead.";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --template-id <id> --account account.json",
    "<%= config.bin %> <%= command.id %> --file sms-draft.yaml --account account.json"
  ];
  static override readonly flags = {
    "template-id": Flags.string({ description: "an existing agent template id" }),
    file: Flags.string({
      description: "path to a standalone YAML SMS/VOICE_PRERECORDED definition"
    }),
    account: Flags.string({
      description: "path to a JSON file with the sample account fields",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Preview);
    const client = await this.createSdkClient();
    const account = JSON.parse(readFileSync(flags.account, "utf8"));

    if (!flags.file && !flags["template-id"]) {
      this.error("Provide --template-id or --file.", { exit: 1 });
    }

    const { rendered } = await client.agentTemplates.preview(
      flags.file
        ? { yaml: readFileSync(flags.file, "utf8"), account }
        : { agentTemplateId: flags["template-id"] as string, account }
    );
    this.log(rendered);
  }
}
