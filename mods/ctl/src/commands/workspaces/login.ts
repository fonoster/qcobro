import { confirm, input, password } from "@inquirer/prompts";
import { Client } from "@qcobro/sdk";
import { BaseCommand } from "../../BaseCommand.js";
import { createAddWorkspace, getConfig, saveConfig } from "../../config/index.js";
import { CONFIG_FILE, DEFAULT_ENDPOINT } from "../../constants.js";
import type { WorkspaceConfig } from "../../config/types.js";

export default class Login extends BaseCommand<typeof Login> {
  static override readonly description = "link a QCobro workspace to the local environment";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    this.log("This utility links a QCobro workspace to the CLI.");
    this.log("Press ^C at any time to quit.");

    const answers = {
      endpoint: await input({ message: "Endpoint", default: DEFAULT_ENDPOINT }),
      accessKeyId: await input({
        message: "Access Key Id (API key, starts with AP)",
        required: true
      }),
      accessKeySecret: await password({ message: "Access Key Secret" }),
      workspaceAccessKeyId: await input({
        message: "Workspace to act in (accessKeyId, starts with WO)",
        required: true
      }),
      confirmed: await confirm({ message: "Ready?" })
    };

    if (!answers.confirmed) {
      this.log("Aborted!");
      return;
    }

    await this.validateCredentials(answers);

    const workspace: WorkspaceConfig = {
      name: answers.workspaceAccessKeyId,
      endpoint: answers.endpoint,
      workspaceAccessKeyId: answers.workspaceAccessKeyId,
      accessKeyId: answers.accessKeyId,
      accessKeySecret: answers.accessKeySecret
    };

    const workspaces = getConfig(CONFIG_FILE);
    const addWorkspace = createAddWorkspace(workspaces);

    try {
      const updated = await addWorkspace(workspace);
      saveConfig(CONFIG_FILE, updated);
    } catch (err) {
      this.error(err instanceof Error ? err.message : String(err));
    }

    this.log("Done!");
  }

  private async validateCredentials(answers: {
    endpoint: string;
    accessKeyId: string;
    accessKeySecret: string;
    workspaceAccessKeyId: string;
  }): Promise<void> {
    const client = new Client({ endpoint: answers.endpoint });

    try {
      await client.loginWithApiKey({
        accessKeyId: answers.accessKeyId,
        accessKeySecret: answers.accessKeySecret
      });
      client.useWorkspace(answers.workspaceAccessKeyId);
      // Sanity call: confirms the key is valid AND a member of the given workspace.
      await client.portfolios.list();
    } catch (err) {
      this.error(
        `Invalid credentials or workspace: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
