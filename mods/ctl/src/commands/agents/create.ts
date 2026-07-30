import { Flags, Interfaces } from "@oclif/core";
import type { CreateAgentTemplateInput } from "@qcobro/common";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";

export default class Create extends AuthenticatedCommand<typeof Create> {
  static override readonly description = "create an agent template in the active workspace";
  static override readonly examples = [
    '<%= config.bin %> <%= command.id %> --type VOICE_AI --name "Cobranza suave" --voice sofia --system-prompt "Sé amable y directo." --language es',
    '<%= config.bin %> <%= command.id %> --type SMS --name "Recordatorio" --message-body "Hola {{firstName}}, tienes un saldo pendiente."'
  ];
  static override readonly flags = {
    type: Flags.string({
      description: "agent channel type",
      options: ["VOICE_AI", "VOICE_PRERECORDED", "SMS", "EMAIL", "WHATSAPP"],
      required: true
    }),
    name: Flags.string({ description: "template name", required: true }),
    // Voice (VOICE_AI, VOICE_PRERECORDED)
    voice: Flags.string({ description: "voice identifier (voice channel types)" }),
    language: Flags.string({ description: "language code (voice channel types)" }),
    "system-prompt": Flags.string({
      description: "AI persona/instructions (VOICE_AI, EMAIL, WHATSAPP)"
    }),
    "first-message": Flags.string({ description: "opening line (VOICE_AI, optional)" }),
    script: Flags.string({ description: "full TTS script (VOICE_PRERECORDED)" }),
    "fonoster-app-name": Flags.string({ description: "Fonoster application name (voice types)" }),
    // Text (SMS, EMAIL, WHATSAPP)
    "message-body": Flags.string({ description: "message text (SMS, EMAIL)" }),
    "sender-id": Flags.string({ description: "sender identifier (SMS, optional)" }),
    subject: Flags.string({ description: "email subject (EMAIL)" }),
    "max-replies": Flags.integer({ description: "reply cap per gestión (EMAIL, WHATSAPP)" }),
    "template-name": Flags.string({ description: "Meta template name (WHATSAPP)" })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Create);
    const client = await this.createSdkClient();

    const payload = this.buildPayload(flags);
    const created = await client.agentTemplates.create(payload);

    this.log(`Created agent template ${created.id} (${created.type}) "${created.name}".`);
  }

  private buildPayload(
    flags: Interfaces.InferredFlags<typeof Create.flags>
  ): CreateAgentTemplateInput {
    const base = { name: flags.name };

    switch (flags.type) {
      case "VOICE_AI":
        return {
          ...base,
          type: "VOICE_AI",
          voice: this.required(flags.voice, "--voice"),
          systemPrompt: this.required(flags["system-prompt"], "--system-prompt"),
          firstMessage: flags["first-message"],
          language: this.required(flags.language, "--language"),
          fonosterAppName: flags["fonoster-app-name"]
        };
      case "VOICE_PRERECORDED":
        return {
          ...base,
          type: "VOICE_PRERECORDED",
          voice: this.required(flags.voice, "--voice"),
          script: this.required(flags.script, "--script"),
          language: this.required(flags.language, "--language"),
          fonosterAppName: flags["fonoster-app-name"]
        };
      case "SMS":
        return {
          ...base,
          type: "SMS",
          messageBody: this.required(flags["message-body"], "--message-body"),
          senderId: flags["sender-id"]
        };
      case "EMAIL":
        return {
          ...base,
          type: "EMAIL",
          subject: this.required(flags.subject, "--subject"),
          messageBody: this.required(flags["message-body"], "--message-body"),
          systemPrompt: this.required(flags["system-prompt"], "--system-prompt"),
          maxReplies: flags["max-replies"]
        };
      case "WHATSAPP":
        return {
          ...base,
          type: "WHATSAPP",
          templateName: this.required(flags["template-name"], "--template-name"),
          messageBody: this.required(flags["message-body"], "--message-body"),
          systemPrompt: this.required(flags["system-prompt"], "--system-prompt"),
          maxReplies: flags["max-replies"]
        };
      default:
        return this.error(`Unknown agent type: ${flags.type as string}`, { exit: 1 });
    }
  }

  private required(value: string | undefined, flagName: string): string {
    if (!value) this.error(`Missing required flag ${flagName} for this agent type.`, { exit: 1 });
    return value;
  }
}
