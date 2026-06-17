import {
  deletePortfolioSchema,
  withErrorHandlingAndValidation,
  type PortfolioClient,
  type DeletePortfolioInput
} from "@qcobro/common";

export function createDeletePortfolio(client: PortfolioClient, workspaceRef: string) {
  const fn = async (params: DeletePortfolioInput) => {
    await client.portfolio.findFirstOrThrow({ where: { id: params.id, workspaceRef } });
    return client.portfolio.delete({ where: { id: params.id } });
  };
  return withErrorHandlingAndValidation(fn, deletePortfolioSchema);
}
