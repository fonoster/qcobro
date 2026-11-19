// Test support: an in-memory stand-in for the Prisma calls the recovery functions make.
// Not a test file itself (no `.test.ts`), so the runner only loads it through the tests.
type Row = Record<string, unknown>;

/** Matches a stored row against the subset of Prisma `where` syntax these functions use. */
export function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond === undefined) return true;
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
    if (Array.isArray(cond)) return false;
    if (typeof cond === "object") {
      const c = cond as Row;
      if ("in" in c) return (c.in as unknown[]).includes(value);
      if ("has" in c) return (value as unknown[]).includes(c.has);
      if ("gte" in c || "lt" in c) {
        const t = (value as Date).getTime();
        if (c.gte && t < (c.gte as Date).getTime()) return false;
        if (c.lt && t >= (c.lt as Date).getTime()) return false;
        return true;
      }
      return matches((value ?? {}) as Row, c);
    }
    return value === cond;
  });
}

export function settingsClient(timezone = "America/Santo_Domingo", currency = "DOP") {
  const row = {
    workspaceRef: "ws",
    timezone,
    currency,
    locale: "es-DO",
    createdAt: new Date(),
    updatedAt: new Date()
  };
  return {
    workspaceSettings: {
      findUnique: async () => row,
      upsert: async () => row
    }
  };
}

const byDetectedDesc = (a: Row, b: Row) =>
  (b.detectedAt as Date).getTime() - (a.detectedAt as Date).getTime();
const byExitedDesc = (a: Row, b: Row) =>
  (b.exitedAt as Date).getTime() - (a.exitedAt as Date).getTime();

/** A read client over seeded recoveries and exits. */
export function readClient(seed: { recoveries?: Row[]; exits?: Row[] }) {
  const recoveries = seed.recoveries ?? [];
  const exits = seed.exits ?? [];
  const page = <T>(rows: T[], args: { take?: number; skip?: number }) =>
    rows.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? rows.length));
  return {
    recovery: {
      findMany: async (args: { where: Row; take?: number; skip?: number }) =>
        page(recoveries.filter((r) => matches(r, args.where)).sort(byDetectedDesc), args),
      count: async (args: { where: Row }) => recoveries.filter((r) => matches(r, args.where)).length
    },
    accountExit: {
      findMany: async (args: { where: Row; take?: number; skip?: number }) =>
        page(exits.filter((e) => matches(e, args.where)).sort(byExitedDesc), args),
      count: async (args: { where: Row }) => exits.filter((e) => matches(e, args.where)).length
    },
    ...settingsClient()
  };
}

let seq = 0;

/** A Recovery row as Prisma returns it, with the relations the read functions include. */
export function recovery(fields: Row = {}): Row {
  const id = `rec-${++seq}`;
  return {
    id,
    portfolioId: "p1",
    portfolioAccountId: `acc-${id}`,
    portfolio: { workspaceRef: "ws" },
    portfolioAccount: { externalId: `C-${id}`, fullName: "Ana Pérez" },
    exitId: null,
    kind: "CAUGHT_UP",
    installments: 1,
    amount: 1000,
    detectedAt: new Date("2026-10-15T15:00:00Z"),
    previousSyncAt: new Date("2026-10-08T15:00:00Z"),
    hasGestion: true,
    lastTouchAgentType: "VOICE_AI",
    lastTouchOutcome: "PAYMENT_PROMISE",
    daysSinceLastTouch: 1,
    campaignIds: [],
    context: {
      hasGestion: true,
      touches: 1,
      activeCampaigns: [],
      lastTouch: null,
      daysSinceLastTouch: 1
    },
    ...fields
  };
}
