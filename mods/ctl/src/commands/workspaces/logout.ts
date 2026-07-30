import { Args, Command } from "@oclif/core";
import { getConfig, removeWorkspace, saveConfig } from "../../config/index.js";
import { CONFIG_FILE } from "../../constants.js";

export default class Logout extends Command {
  static override readonly description = "unlink a QCobro workspace from the local environment";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> WO6ueex0qan9ojhf820wgiae3qi5luy08y"
  ];
  static override readonly args = {
    workspaceAccessKeyId: Args.string({
      description: "the workspace to unlink (its accessKeyId)",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Logout);
    const workspaces = getConfig(CONFIG_FILE);
    const updated = removeWorkspace(args.workspaceAccessKeyId, workspaces);
    saveConfig(CONFIG_FILE, updated);
    this.log("Done!");
  }
}
