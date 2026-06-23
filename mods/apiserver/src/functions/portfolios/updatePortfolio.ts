import {
  updatePortfolioSchema,
  withErrorHandlingAndValidation,
  type PortfolioClient,
  type UpdatePortfolioInput
} from "@qcobro/common";

export function createUpdatePortfolio(client: PortfolioClient, workspaceRef: string) {
  const fn = async (params: UpdatePortfolioInput) => {
    await client.portfolio.findFirstOrThrow({ where: { id: params.id, workspaceRef } });
    const { id, archived, ...rest } = params;
    const data: Record<string, unknown> = { ...rest };
    // Translate the `archived` toggle into an archivedAt timestamp (or clear it).
    if (archived !== undefined) data.archivedAt = archived ? new Date() : null;
    return client.portfolio.update({ where: { id }, data });
  };
  return withErrorHandlingAndValidation(fn, updatePortfolioSchema);
}
