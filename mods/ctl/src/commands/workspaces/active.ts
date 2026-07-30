import cliui from "cliui";
import { Command } from "@oclif/core";
import { getActiveWorkspace, getConfig } from "../../config/index.js";
import { CONFIG_FILE } from "../../constants.js";

export default class Active extends Command {
  static override readonly description = "display the active QCobro workspace";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    const workspaces = getConfig(CONFIG_FILE);
    const activeWorkspace = getActiveWorkspace(workspaces);

    if (!activeWorkspace) {
      this.error("No active workspace found. Run `qcobro workspaces:login` first.", { exit: 1 });
    }

    const { name, workspaceAccessKeyId, endpoint } = activeWorkspace;
    const ui = cliui({ width: 200 });

    ui.div(
      "ACTIVE WORKSPACE\n" +
        "------------------\n" +
        `NAME: \t${name}\n` +
        `WORKSPACE ACCESS KEY ID: \t${workspaceAccessKeyId}\n` +
        `ENDPOINT: \t${endpoint}\n`
    );

    this.log(ui.toString());
  }
}
