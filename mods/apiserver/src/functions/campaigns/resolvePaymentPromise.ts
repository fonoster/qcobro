import {
  updatePaymentPromiseSchema,
  withErrorHandlingAndValidation,
  type CampaignClient,
  type PaymentPromiseRecord,
  type UpdatePaymentPromiseInput
} from "@qcobro/common";

/**
 * Resolve a payment promise by explicit operator action: the operator can only cancel it.
 * A promise becomes `MET` only when a sync closes the account's episode as CURED or
 * PAID_OFF, so nothing here touches the portfolio.
 */
export async function resolvePaymentPromiseTx(
  tx: CampaignClient,
  input: UpdatePaymentPromiseInput
): Promise<PaymentPromiseRecord> {
  const promise = await tx.paymentPromise.findFirst({ where: { id: input.id } });
  if (!promise) {
    throw new Error(`PaymentPromise ${input.id} not found`);
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
