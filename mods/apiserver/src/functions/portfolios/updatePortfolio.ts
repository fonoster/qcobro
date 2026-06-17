import {
  updatePortfolioSchema,
  withErrorHandlingAndValidation,
  type PortfolioClient,
  type UpdatePortfolioInput
} from "@qcobro/common";

export function createUpdatePortfolio(client: PortfolioClient, workspaceRef: string) {
  const fn = async (params: UpdatePortfolioInput) => {
    await client.portfolio.findFirstOrThrow({ where: { id: params.id, workspaceRef } });
    const { id, ...data } = params;
    return client.portfolio.update({ where: { id }, data });
  };
  return withErrorHandlingAndValidation(fn, updatePortfolioSchema);
}
