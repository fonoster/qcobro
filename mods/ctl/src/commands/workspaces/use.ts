import { Args, Command } from "@oclif/core";
import {
  getActiveWorkspace,
  getConfig,
  saveConfig,
  setActiveWorkspace
} from "../../config/index.js";
import { CONFIG_FILE } from "../../constants.js";

export default class Use extends Command {
  static override readonly description = "set a linked workspace as the active one";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> WO6ueex0qan9ojhf820wgiae3qi5luy08y"
  ];
  static override readonly args = {
    workspaceAccessKeyId: Args.string({
      description: "the workspace to activate (its accessKeyId)",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Use);
    const workspaces = getConfig(CONFIG_FILE);
    const updated = setActiveWorkspace(args.workspaceAccessKeyId, workspaces);
    const activeWorkspace = getActiveWorkspace(updated);

    if (!activeWorkspace) {
      this.error(`No linked workspace found with accessKeyId "${args.workspaceAccessKeyId}".`, {
        exit: 1
      });
    }

    saveConfig(CONFIG_FILE, updated);

    this.log(
      `Current workspace: ${activeWorkspace.name} (${activeWorkspace.workspaceAccessKeyId})`
    );
  }
}
