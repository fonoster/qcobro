import { z } from "zod";

export const PortfolioSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  clientId: z.string(),
  accounts: z.number().int().nonnegative(),
  totalAmount: z.number().nonnegative(),
  recoveredAmount: z.number().nonnegative(),
  status: z.enum(["ACTIVE", "CLOSED"]),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const CampaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  portfolioId: z.string().uuid(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  accounts: z.number().int().nonnegative(),
  startDate: z.date().nullable().optional(),
  endDate: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const ActivitySchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  accountId: z.string(),
  agentId: z.string().uuid().nullable().optional(),
  channel: z.enum(["CALL", "SMS", "WHATSAPP", "EMAIL"]),
  outcome: z.enum(["CONTACTED", "NOT_CONTACTED", "PROMISE", "REJECTED", "PENDING"]),
  notes: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const PromiseSchema = z.object({
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  accountId: z.string(),
  amount: z.number().positive(),
  dueDate: z.date(),
  status: z.enum(["PENDING", "FULFILLED", "OVERDUE", "CANCELLED"]),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  strategy: z.enum(["AGGRESSIVE", "MODERATE", "GENTLE"]),
  status: z.enum(["ACTIVE", "PAUSED"]),
  calls: z.number().int().nonnegative(),
  promises: z.number().int().nonnegative(),
  recovered: z.number().nonnegative(),
  successRate: z.number().min(0).max(100),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "SUPERVISOR", "AGENT"]),
  createdAt: z.date()
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
