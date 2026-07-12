import {
  cycleTurnoverSchema,
  withErrorHandlingAndValidation,
  type BillingClient,
  type CycleTurnoverInput
} from "@qcobro/common";
import { workspaceBalanceMicroTx } from "./workspaceBalance.js";

/**
 * Turns a workspace's billing cycle over at the invoice.paid boundary: voids
 * the unused remainder of the closing cycle (no rollover), grants the new
 * (possibly prorated) allowance, and stamps the new cycle bounds.
 *
 * Idempotency: the GRANT is created FIRST under the
 * (workspaceRef, stripeInvoiceId, kind) unique — a replayed webhook hits the
 * constraint before any void/state write, so the whole turnover no-ops.
 */
export async function cycleTurnoverTx(
  tx: BillingClient,
  input: CycleTurnoverInput
): Promise<{ applied: boolean; voidedMicro: number }> {
  const at = new Date(input.at);
  try {
    await tx.ledgerEntry.create({
      data: {
        workspaceRef: input.workspaceRef,
        kind: "GRANT",
        amountMicro: BigInt(input.grantMicro),
        at,
        stripeInvoiceId: input.stripeInvoiceId
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { applied: false, voidedMicro: 0 };
    throw err;
  }

  // Balance before this grant = closing cycle's remainder; void it if positive.
  const balanceWithGrant = await workspaceBalanceMicroTx(tx, input.workspaceRef);
  const remainder = balanceWithGrant - input.grantMicro;
  const voidedMicro = remainder > 0 ? remainder : 0;
  if (voidedMicro > 0) {
    await tx.ledgerEntry.create({
      data: {
        workspaceRef: input.workspaceRef,
        kind: "VOID",
        amountMicro: BigInt(-voidedMicro),
        at,
        stripeInvoiceId: input.stripeInvoiceId
      }
    });
  }

  await tx.workspaceBilling.update({
    where: { workspaceRef: input.workspaceRef },
    data: { cycleStart: new Date(input.cycleStart), cycleEnd: new Date(input.cycleEnd) }
  });
  return { applied: true, voidedMicro };
}

/** Prisma unique-constraint violation (P2002), without importing Prisma here. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

/** Factory: turn one workspace's cycle over in its own transaction. */
export function createCycleTurnover(client: BillingClient) {
  const fn = (input: CycleTurnoverInput) => client.$transaction((tx) => cycleTurnoverTx(tx, input));
  return withErrorHandlingAndValidation(fn, cycleTurnoverSchema);
}
