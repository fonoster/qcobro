import cliui from "cliui";
import { Flags } from "@oclif/core";
import { RECOVERY_BREAKDOWN_DIMENSIONS, type RecoveryBreakdownInput } from "@qcobro/common";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";
import { periodFlags } from "../../commandFlags.js";

export default class Breakdown extends AuthenticatedCommand<typeof Breakdown> {
  static override readonly description = "break down the amount recovered in a period";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --by CHANNEL --from 2026-10-01 --to 2026-10-31",
    "<%= config.bin %> <%= command.id %> --by CAMPAIGN --from 2026-10-01 --to 2026-10-31 --portfolio-id <id>"
  ];
  static override readonly flags = {
    by: Flags.string({
      description: "dimension to group by",
      options: [...RECOVERY_BREAKDOWN_DIMENSIONS],
      required: true
    }),
    ...periodFlags
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Breakdown);
    const client = await this.createSdkClient();
    const breakdown = await client.recovery.breakdown({
      by: flags.by as RecoveryBreakdownInput["by"],
      from: flags.from,
      to: flags.to,
      portfolioId: flags["portfolio-id"]
    });

    const byCampaign = flags.by === "CAMPAIGN";
    const ui = cliui({ width: 140 });
    const row = (key: string, name: string | null, amount: string, count: string) =>
      ui.div(
        { text: key, padding: [0, 0, 0, 0], width: byCampaign ? 40 : 20 },
        ...(byCampaign ? [{ text: name ?? "-", padding: [0, 0, 0, 0], width: 40 }] : []),
        { text: amount, padding: [0, 0, 0, 0], width: 14 },
        { text: count, padding: [0, 0, 0, 0] }
      );

    row("KEY", "NAME", "AMOUNT", "COUNT");
    for (const r of breakdown.rows) {
      row(r.key, r.name, String(r.amount), String(r.count));
    }
    if (!byCampaign) {
      const amount = breakdown.rows.reduce((sum, r) => sum + r.amount, 0);
      const count = breakdown.rows.reduce((sum, r) => sum + r.count, 0);
      row("TOTAL", null, String(amount), String(count));
    }

    this.log(ui.toString());
    if (byCampaign) {
      this.log(
        "Amounts are not additive: each campaign active on an account is credited the full amount."
      );
    }
  }
}
