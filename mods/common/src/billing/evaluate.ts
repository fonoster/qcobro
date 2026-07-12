import type { BillingConfig } from "../config.js";
import { billedSeconds, parseIncrements } from "./pricing.js";
import { sumMicroUnits, toMicroUnits } from "./money.js";
import type { LedgerEntry, UsageRecord } from "./ledger.js";
import { MESSAGE_METERS, VOICE_METERS, type BillingMeter } from "./rates.js";

/**
 * Billing evaluation (billing-evaluation spec) — the pure, deployment-agnostic
 * invariants, judged over a set of usage records + ledger entries (from the
 * simulation or exported from a live deployment). Sibling of the engine
 * scorecard: under-detects, never false-positives.
 */

export interface BillingInvariantResult {
  id: string;
  description: string;
  verdict: "pass" | "fail";
  details?: string;
}

export interface BillingScorecard {
  verdict: "pass" | "fail";
  invariants: BillingInvariantResult[];
}

/**
 * Rough per-unit provider floors (USD): what QCobro itself pays per unit, so a
 * configured rate below its floor sells at a loss. Overridable per deployment;
 * voice floors are per minute.
 */
export const DEFAULT_PROVIDER_FLOORS: Record<BillingMeter, number> = {
  sms: 0.0079, // Twilio US outbound per segment
  email: 0.0004, // Resend at volume
  whatsappMessage: 0.004, // Meta marketing/utility blend, region-dependent
  voicePrerecorded: 0.014, // carrier per-minute
  voiceAi: 0.09, // carrier + STT/LLM/TTS per-minute blend
  whatsappVoicePrerecorded: 0.005,
  whatsappVoiceAi: 0.09
};

export interface BillingEvaluationInput {
  billing: NonNullable<BillingConfig>;
  usageRecords: UsageRecord[];
  ledgerEntries: LedgerEntry[];
  /** Per-meter floors; defaults to {@link DEFAULT_PROVIDER_FLOORS}. */
  providerFloors?: Partial<Record<BillingMeter, number>>;
}

const CANONICAL_VECTORS: Array<{ answered: number; billed: number }> = [
  { answered: 0, billed: 0 },
  { answered: 1, billed: 15 },
  { answered: 15, billed: 15 },
  { answered: 16, billed: 30 },
  { answered: 35, billed: 45 }
];

export function evaluateBilling(input: BillingEvaluationInput): BillingScorecard {
  const invariants: BillingInvariantResult[] = [];
  const floors = { ...DEFAULT_PROVIDER_FLOORS, ...input.providerFloors };

  // BIL-1 — Ledger conservation: total usage spend in the ledger equals the sum
  // of priced usage records, exact to the micro-unit (settlements included).
  {
    const debits = sumMicroUnits(
      input.ledgerEntries
        .filter((entry) => entry.kind === "USAGE_DEBIT" || entry.kind === "ADJUSTMENT")
        .map((entry) => entry.amountMicro)
    );
    const priced = sumMicroUnits(input.usageRecords.map((record) => record.amountMicro));
    const ok = -debits === priced;
    invariants.push({
      id: "BIL-1",
      description: "sum(ledger usage debits + adjustments) equals sum(priced usage records)",
      verdict: ok ? "pass" : "fail",
      details: ok ? undefined : `ledger ${-debits} vs records ${priced} micro-units`
    });
  }

  // BIL-2 — Balance derivation: every workspace balance is exactly the entry sum
  // (guards against cached-balance drift when the input carries one).
  {
    const balance = sumMicroUnits(input.ledgerEntries.map((entry) => entry.amountMicro));
    invariants.push({
      id: "BIL-2",
      description: "derived balances are exact integer micro-unit sums",
      verdict: Number.isSafeInteger(balance) ? "pass" : "fail"
    });
  }

  // BIL-3 — Canonical increment vectors under 15/15.
  {
    const pair = parseIncrements("15/15");
    const failed = CANONICAL_VECTORS.filter((v) => billedSeconds(v.answered, pair) !== v.billed);
    invariants.push({
      id: "BIL-3",
      description: "canonical 15/15 vectors (1→15, 15→15, 16→30, 35→45, unanswered→0)",
      verdict: failed.length === 0 ? "pass" : "fail",
      details: failed.length ? JSON.stringify(failed) : undefined
    });
  }

  // BIL-4 — Settled voice records: quantity matches the increment formula for
  // the frozen increments (records must never carry off-grid quantities).
  {
    const offenders = input.usageRecords.filter((record) => {
      if (!VOICE_METERS.includes(record.meter as (typeof VOICE_METERS)[number])) return false;
      const increments = (record as { increments?: string }).increments;
      if (!increments) return true;
      const pair = parseIncrements(increments);
      return billedSeconds(record.quantity, pair) !== record.quantity;
    });
    invariants.push({
      id: "BIL-4",
      description: "voice usage quantities land on the increment grid",
      verdict: offenders.length === 0 ? "pass" : "fail",
      details: offenders.length ? `${offenders.length} off-grid records` : undefined
    });
  }

  // BIL-5 — Margin guard: every configured rate covers its provider floor.
  {
    const violations: string[] = [];
    for (const plan of input.billing.plans) {
      for (const meter of MESSAGE_METERS) {
        if (plan.rates[meter].perMessage < floors[meter]) {
          violations.push(`${plan.key}.${meter}`);
        }
      }
      for (const meter of VOICE_METERS) {
        if (plan.rates[meter].perMinute < floors[meter]) {
          violations.push(`${plan.key}.${meter}`);
        }
      }
    }
    invariants.push({
      id: "BIL-5",
      description: "every plan rate is at or above its provider floor",
      verdict: violations.length === 0 ? "pass" : "fail",
      details: violations.length ? violations.join(", ") : undefined
    });
  }

  // BIL-6 — Grant/void idempotency shape: at most one GRANT and one VOID per
  // (workspace, stripeInvoiceId) — replayed webhooks must not double-book.
  {
    const seen = new Map<string, number>();
    for (const entry of input.ledgerEntries) {
      if (!entry.stripeInvoiceId) continue;
      const key = `${entry.workspaceRef}|${entry.stripeInvoiceId}|${entry.kind}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const duplicated = [...seen.entries()].filter(([, count]) => count > 1);
    invariants.push({
      id: "BIL-6",
      description: "one grant/void per (workspace, invoice) — replays no-op",
      verdict: duplicated.length === 0 ? "pass" : "fail",
      details: duplicated.length ? duplicated.map(([k]) => k).join(", ") : undefined
    });
  }

  return {
    verdict: invariants.some((inv) => inv.verdict === "fail") ? "fail" : "pass",
    invariants
  };
}

/** Convenience: the worst tolerated negative balance for N in-flight voice calls. */
export function voiceOvershootBoundMicro(
  perMinute: number,
  increments: string,
  estimateSeconds: number,
  maxAnsweredSeconds: number,
  concurrentCalls: number
): number {
  const pair = parseIncrements(increments);
  const perMinuteMicro = toMicroUnits(perMinute);
  const estimate = Math.round(
    (billedSeconds(Math.max(estimateSeconds, pair.initialSeconds), pair) * perMinuteMicro) / 60
  );
  const worst = Math.round((billedSeconds(maxAnsweredSeconds, pair) * perMinuteMicro) / 60);
  return Math.max(0, worst - estimate) * concurrentCalls;
}
