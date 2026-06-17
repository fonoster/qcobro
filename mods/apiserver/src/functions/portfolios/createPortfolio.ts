import {
  createPortfolioSchema,
  withErrorHandlingAndValidation,
  type PortfolioClient
} from "@qcobro/common";

export function createCreatePortfolio(client: PortfolioClient, workspaceRef: string) {
  const fn = async (params: { name: string; clientId: string; currency: "USD" | "DOP" }) => {
    return client.portfolio.create({
      data: {
        workspaceRef,
        name: params.name,
        clientId: params.clientId,
        currency: params.currency,
        totalOutstandingBalance: 0,
        accountCount: 0,
        recoveredAmount: 0,
        status: "ACTIVE"
      }
    });
  };
  return withErrorHandlingAndValidation(fn, createPortfolioSchema);
}
