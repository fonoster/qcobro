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
