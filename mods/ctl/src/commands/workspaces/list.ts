import cliui from "cliui";
import { Command } from "@oclif/core";
import { getConfig } from "../../config/index.js";
import { CONFIG_FILE } from "../../constants.js";

export default class List extends Command {
  static override readonly description = "display all linked QCobro workspaces";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    const workspaces = getConfig(CONFIG_FILE);
    const ui = cliui({ width: 120 });

    ui.div(
      { text: "WORKSPACE ACCESS KEY ID", padding: [0, 0, 0, 0] },
      { text: "NAME", padding: [0, 0, 0, 0] },
      { text: "STATUS", padding: [0, 0, 0, 0] }
    );

    workspaces.forEach((workspace) => {
      ui.div(
        { text: workspace.workspaceAccessKeyId, padding: [0, 0, 0, 0] },
        { text: workspace.name, padding: [0, 0, 0, 0] },
        { text: workspace.active ? "[ACTIVE]" : "", padding: [0, 0, 0, 0] }
      );
    });

    this.log(ui.toString());
  }
}
