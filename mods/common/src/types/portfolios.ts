import type { RecoveryTx } from "./recovery.js";
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
  accountCount: number;
  totalOutstandingBalance: number;
  lastSyncedAt: Date | null;
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
  lastSyncedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
        "id" | "accountCount" | "lastSyncedAt" | "archivedAt" | "createdAt" | "updatedAt"
      > & { accountCount?: number; lastSyncedAt?: Date | null };
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
      select?: Record<string, boolean>;
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
      where: { portfolioId: string; id: { in: string[] } };
      data: { archivedAt: Date };
    }): Promise<{ count: number }>;
  };

  $transaction<T>(fn: (tx: PortfolioClient) => Promise<T>): Promise<T>;
}

/** The transaction the sync runs in: the portfolio surface plus recovery tracking. */
export type SyncAccountsTx = Omit<PortfolioClient, "$transaction"> & RecoveryTx;

export interface SyncAccountsClient {
  $transaction<T>(
    fn: (tx: SyncAccountsTx) => Promise<T>,
    options?: { timeout?: number }
  ): Promise<T>;
}

export type { CreatePortfolioInput, UpdatePortfolioInput, DeletePortfolioInput, AccountRowInput };
