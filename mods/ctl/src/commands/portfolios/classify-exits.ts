import { Flags } from "@oclif/core";
import type { ClassifyExitsInput } from "@qcobro/common";
import { AuthenticatedCommand } from "../../AuthenticatedCommand.js";
import { readJsonFile } from "../../readJsonFile.js";

export default class ClassifyExits extends AuthenticatedCommand<typeof ClassifyExits> {
  static override readonly description =
    "assign a reason to exits recorded as UNKNOWN, from a JSON file";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --portfolio-id <id> --file classify.json"
  ];
  static override readonly flags = {
    "portfolio-id": Flags.string({ description: "the portfolio id", required: true }),
    file: Flags.string({
      description:
        "path to a JSON file containing an array of { externalId, reason, missedInstallments, termsAmount } (the last two only for CAUGHT_UP and PAID_OFF)",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ClassifyExits);

    let exits: unknown;
    try {
      exits = readJsonFile(flags.file);
    } catch (err) {
      this.error((err as Error).message, { exit: 1 });
    }

    const client = await this.createSdkClient();
    const result = await client.portfolios.classifyExits({
      portfolioId: flags["portfolio-id"],
      exits: exits as ClassifyExitsInput["exits"]
    });

    const { caughtUp, paidOff, amount } = result.recoveries;
    this.log(
      `Classified ${result.classified}: ${caughtUp} caught up, ${paidOff} paid off (amount ${amount}); ${result.promisesMet} promises met.`
    );
  }
}
