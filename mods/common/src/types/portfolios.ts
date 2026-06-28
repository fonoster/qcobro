import type {
  AccountRowInput,
  CreatePortfolioInput,
  UpdatePortfolioInput,
  DeletePortfolioInput
} from "../schemas/portfolios.js";

export interface PortfolioRecord {
  id: string;
  workspaceRef: string;
  name: string;
  clientId: string;
  currency: string;
  accountCount: number;
  totalOutstandingBalance: number;
  recoveredAmount: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioAccountRecord {
  id: string;
  portfolioId: string;
  externalId: string;
  fullName: string;
  phone: string | null;
  preferredLanguage: string | null;
  bestTimeToCall: string | null;
  customerSegment: string | null;
  principalAmount: number;
  termsAmount: number;
  termsFrequency: string | null;
  termsLength: number;
  outstandingBalance: number;
  daysPastDue: number;
  missedInstallments: number;
  lastPaymentDate: Date | null;
  lastPaymentAmount: number | null;
  negotiationOptions: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncResult {
  created: number;
  updated: number;
  archived: number;
  total: number;
}

export interface PortfolioClient {
  portfolio: {
    findMany(args: {
      where?: { workspaceRef?: string; archivedAt?: Date | null };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<PortfolioRecord[]>;

    findFirstOrThrow(args: {
      where: { id: string; workspaceRef: string };
    }): Promise<PortfolioRecord>;

    create(args: {
      data: Omit<
        PortfolioRecord,
        "id" | "accountCount" | "recoveredAmount" | "archivedAt" | "createdAt" | "updatedAt"
      > & { accountCount?: number; recoveredAmount?: number };
    }): Promise<PortfolioRecord>;

    update(args: {
      where: { id: string };
      data: Partial<Omit<PortfolioRecord, "id" | "createdAt" | "updatedAt">>;
    }): Promise<PortfolioRecord>;

    delete(args: { where: { id: string } }): Promise<PortfolioRecord>;
  };

  portfolioAccount: {
    findMany(args: {
      where: { portfolioId: string; archivedAt?: null };
      select?: { externalId: boolean };
      orderBy?: { fullName: "asc" | "desc" };
      take?: number;
      skip?: number;
    }): Promise<PortfolioAccountRecord[]>;

    count(args: { where: { portfolioId: string; archivedAt?: null } }): Promise<number>;

    aggregate(args: {
      where: { portfolioId: string; archivedAt?: null };
      _sum: { outstandingBalance: boolean };
    }): Promise<{ _sum: { outstandingBalance: number | null } }>;

    create(args: {
      data: Omit<PortfolioAccountRecord, "id" | "archivedAt" | "createdAt" | "updatedAt"> & {
        archivedAt?: Date | null;
      };
    }): Promise<PortfolioAccountRecord>;

    update(args: {
      where: { portfolioId_externalId: { portfolioId: string; externalId: string } };
      data: Partial<
        Omit<
          PortfolioAccountRecord,
          "id" | "portfolioId" | "externalId" | "createdAt" | "updatedAt"
        >
      >;
    }): Promise<PortfolioAccountRecord>;

    updateMany(args: {
      where: { portfolioId: string; externalId: { in: string[] } };
      data: { archivedAt: Date };
    }): Promise<{ count: number }>;
  };

  // When accounts leave a portfolio, their PENDING payment promises are expired so
  // collectors do not chase an account that is no longer theirs.
  paymentPromise: {
    updateMany(args: {
      where: Record<string, unknown>;
      data: { status: "EXPIRED" };
    }): Promise<{ count: number }>;
  };

  $transaction<T>(fn: (tx: PortfolioClient) => Promise<T>): Promise<T>;
}

export type { CreatePortfolioInput, UpdatePortfolioInput, DeletePortfolioInput, AccountRowInput };
