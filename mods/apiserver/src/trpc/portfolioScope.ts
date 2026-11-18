import { TRPCError } from "@trpc/server";
import { ValidationError } from "@qcobro/common";

/**
 * Throws NOT_FOUND unless the portfolio belongs to the caller's workspace. Procedures that take
 * a `portfolioId` and read or write its accounts call this first: account queries are keyed by
 * `portfolioId` alone, so without it a caller who knows another tenant's portfolio id could
 * read or change its accounts.
 */
export async function assertPortfolioInWorkspace(
  prisma: { portfolio: { findFirst(args: unknown): Promise<unknown> } },
  portfolioId: string,
  workspaceRef: string
): Promise<void> {
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, workspaceRef },
    select: { id: true }
  });
  if (!portfolio) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Portfolio ${portfolioId} not found` });
  }
}

/**
 * Runs a function and answers its business-rule rejections (a ValidationError raised after the
 * input schema passed, e.g. an exit for an unknown externalId) as BAD_REQUEST: they are the
 * caller's error, like a schema failure, not a server fault.
 */
export async function asBadRequest<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ValidationError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: err.message, cause: err });
    }
    throw err;
  }
}
