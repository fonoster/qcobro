import cliui from "cliui";
import { Flags } from "@oclif/core";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";

export default class List extends AuthenticatedCommand<typeof List> {
  static override readonly description = "display the active workspace's portfolios";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --include-archived"
  ];
  static override readonly flags = {
    "include-archived": Flags.boolean({
      description: "include archived portfolios",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = await this.createSdkClient();
    const portfolios = await client.portfolios.list({
      includeArchived: flags["include-archived"]
    });

    const ui = cliui({ width: 140 });

    ui.div(
      { text: "ID", padding: [0, 0, 0, 0], width: 40 },
      { text: "NAME", padding: [0, 0, 0, 0], width: 40 },
      { text: "CLIENT ID", padding: [0, 0, 0, 0], width: 30 },
      { text: "ARCHIVED", padding: [0, 0, 0, 0] }
    );

    portfolios.forEach((portfolio) => {
      ui.div(
        { text: portfolio.id, padding: [0, 0, 0, 0], width: 40 },
        { text: portfolio.name, padding: [0, 0, 0, 0], width: 40 },
        { text: portfolio.clientId, padding: [0, 0, 0, 0], width: 30 },
        { text: portfolio.archivedAt ? "yes" : "no", padding: [0, 0, 0, 0] }
      );
    });

    this.log(ui.toString());
  }
}
