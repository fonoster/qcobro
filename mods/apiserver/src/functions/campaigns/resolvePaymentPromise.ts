import {
  updatePaymentPromiseSchema,
  withErrorHandlingAndValidation,
  type CampaignClient,
  type PaymentPromiseRecord,
  type UpdatePaymentPromiseInput
} from "@qcobro/common";

/**
 * Resolve a payment promise by explicit operator action: `MET` (paid) or `CANCELLED`.
 * v1 is manual-only — there is no trusted payment signal, so a promise leaves `PENDING`
 * here, never automatically. A `MET` promise feeds the portfolio's `recoveredAmount` by
 * its amount. Idempotent: re-resolving an already-resolved promise does not re-credit.
 */
export async function resolvePaymentPromiseTx(
  tx: CampaignClient,
  input: UpdatePaymentPromiseInput
): Promise<PaymentPromiseRecord> {
  const promise = await tx.paymentPromise.findFirst({ where: { id: input.id } });
  if (!promise) {
    throw new Error(`PaymentPromise ${input.id} not found`);
  }

  // Only credit recoveredAmount on a genuine PENDING → MET transition.
  if (
    input.status === "MET" &&
    promise.status === "PENDING" &&
    typeof promise.amount === "number"
  ) {
    const account = await tx.portfolioAccount.findFirst({
      where: { id: promise.portfolioAccountId }
    });
    if (account) {
      await tx.portfolio.update({
        where: { id: account.portfolioId },
        data: { recoveredAmount: { increment: promise.amount } }
      });
    }
  }

  return tx.paymentPromise.update({
    where: { id: input.id },
    data: { status: input.status }
  });
}

/** Factory: resolve a payment promise in its own transaction. */
export function createResolvePaymentPromise(client: CampaignClient) {
  const fn = (input: UpdatePaymentPromiseInput) =>
    client.$transaction((tx) => resolvePaymentPromiseTx(tx, input));
  return withErrorHandlingAndValidation(fn, updatePaymentPromiseSchema);
}
