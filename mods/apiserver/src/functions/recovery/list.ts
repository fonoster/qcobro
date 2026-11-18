import {
  recoveryListInputSchema,
  withErrorHandlingAndValidation,
  type RecoveryListInput,
  type RecoveryListItem,
  type RecoveryReadClient,
  type WorkspaceSettingsClient
} from "@qcobro/common";
import { createGetWorkspaceSettings } from "../workspaceSettings/getWorkspaceSettings.js";
import { periodRange, recoveryWhere } from "./period.js";

type RecoveryRow = Omit<RecoveryListItem, "externalId" | "fullName"> & {
  portfolioAccount: { externalId: string; fullName: string };
};

/** The recoveries detected in a period, newest first, with the account's id and name. */
export function createRecoveryList(
  client: RecoveryReadClient & WorkspaceSettingsClient,
  workspaceRef: string
) {
  const getSettings = createGetWorkspaceSettings(client);

  const fn = async (
    input: RecoveryListInput
  ): Promise<{ items: RecoveryListItem[]; total: number }> => {
    const settings = await getSettings(workspaceRef);
    const where = {
      ...recoveryWhere(
        workspaceRef,
        periodRange(input.from, input.to, settings.timezone),
        input.portfolioId
      ),
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.hasGestion !== undefined ? { hasGestion: input.hasGestion } : {})
    };
    const [rows, total] = await Promise.all([
      client.recovery.findMany({
        where,
        include: { portfolioAccount: { select: { externalId: true, fullName: true } } },
        orderBy: { detectedAt: "desc" },
        take: input.limit,
        skip: input.offset
      }),
      client.recovery.count({ where })
    ]);
    const items = (rows as unknown as RecoveryRow[]).map((r) => ({
      id: r.id,
      portfolioId: r.portfolioId,
      portfolioAccountId: r.portfolioAccountId,
      externalId: r.portfolioAccount.externalId,
      fullName: r.portfolioAccount.fullName,
      kind: r.kind,
      installments: r.installments,
      amount: r.amount,
      detectedAt: r.detectedAt,
      previousSyncAt: r.previousSyncAt,
      context: r.context
    }));
    return { items, total };
  };

  return withErrorHandlingAndValidation(fn, recoveryListInputSchema);
}
