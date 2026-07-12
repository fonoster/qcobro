/**
 * Per-channel pacing as a simple token bucket. The engine builds a fresh bucket per
 * channel each tick, sized to that channel's share of the per-minute rate, so a tick
 * dispatches at most one interval's budget (no thundering herd at window open). The
 * `tryTake()` interface is the seam for a durable bucket if we ever run >1 instance.
 */
export interface TokenBucket {
  /** Spend one token; returns false when the budget for this tick is exhausted. */
  tryTake(): boolean;
  remaining(): number;
}

export function createTokenBucket(capacity: number): TokenBucket {
  let tokens = Math.max(0, Math.floor(capacity));
  return {
    tryTake() {
      if (tokens > 0) {
        tokens -= 1;
        return true;
      }
      return false;
    },
    remaining() {
      return tokens;
    }
  };
}

// The capacity formula lives in @qcobro/common so the evaluator's SAF-5 check
// can never drift from what the engine enforces; re-exported for callers here.
export { perTickCapacity } from "@qcobro/common";

/**
 * Per-workspace credit gate for one tick, seeded from the ledger balance at tick
 * start and debited in memory per dispatch (micro-units). Like the channel token
 * buckets it is tick-scoped: the ledger stays the source of truth and the next
 * tick reseeds, so an in-memory debit whose dispatch later failed costs nothing.
 * A debit that the remaining balance cannot cover yields `credits_exhausted`.
 */
export interface CreditBucket {
  /** Debit an estimated cost; false when the remaining balance cannot cover it. */
  tryDebit(amountMicro: number): boolean;
  remainingMicro(): number;
}

export function createCreditBucket(balanceMicro: number): CreditBucket {
  let remaining = Math.floor(balanceMicro);
  return {
    tryDebit(amountMicro) {
      if (remaining >= amountMicro && amountMicro >= 0) {
        remaining -= amountMicro;
        return true;
      }
      return false;
    },
    remainingMicro() {
      return remaining;
    }
  };
}
