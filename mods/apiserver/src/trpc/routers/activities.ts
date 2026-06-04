import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

const OUTCOME = z.enum(["CONTACTED", "NOT_CONTACTED", "PROMISE", "REJECTED", "PENDING"]);
const CHANNEL = z.enum(["CALL", "SMS", "WHATSAPP", "EMAIL", "VOICE_AI"]);

export const activitiesRouter = router({
  list: protectedProcedure
    .input(z.object({
      campaignId: z.string().optional(),
      agentId: z.string().optional(),
      outcome: OUTCOME.optional(),
      accountId: z.string().optional(),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().nonnegative().default(0)
    }).optional())
    .query(async ({ input, ctx }) => {
      const where = {
        ...(input?.campaignId ? { campaignId: input.campaignId } : {}),
        ...(input?.agentId ? { agentId: input.agentId } : {}),
        ...(input?.outcome ? { outcome: input.outcome } : {}),
        ...(input?.accountId ? { accountId: input.accountId } : {})
      };
      const [items, total] = await ctx.prisma.$transaction([
        ctx.prisma.activity.findMany({
          where,
          include: {
            campaign: { select: { id: true, name: true, portfolioId: true } }
          },
          orderBy: { createdAt: "desc" },
          take: input?.limit ?? 50,
          skip: input?.offset ?? 0
        }),
        ctx.prisma.activity.count({ where })
      ]);

      const accountIds = [...new Set(items.map((a) => a.accountId))];
      const accounts = await ctx.prisma.account.findMany({
        where: { OR: [{ id: { in: accountIds } }, { externalId: { in: accountIds } }] },
        select: { id: true, externalId: true, fullName: true, phone: true, email: true }
      });
      const accountMap = Object.fromEntries([
        ...accounts.map((a) => [a.id, a]),
        ...accounts.map((a) => [a.externalId, a])
      ]);

      const enriched = items.map((a) => ({
        ...a,
        accountName: accountMap[a.accountId]?.fullName ?? a.accountId,
        accountPhone: accountMap[a.accountId]?.phone ?? null,
        accountEmail: accountMap[a.accountId]?.email ?? null
      }));

      return { items: enriched, total };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const activity = await ctx.prisma.activity.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          campaign: { select: { id: true, name: true } },
          commitments: true
        }
      });
      const account = await ctx.prisma.account.findFirst({
        where: { OR: [{ id: activity.accountId }, { externalId: activity.accountId }] },
        select: { fullName: true, phone: true, email: true }
      });
      return { ...activity, account };
    }),

  create: protectedProcedure
    .input(z.object({
      campaignId: z.string(),
      accountId: z.string(),
      agentId: z.string().optional(),
      channel: CHANNEL.default("CALL"),
      outcome: OUTCOME.default("PENDING"),
      notes: z.string().optional()
    }))
    .mutation(({ input, ctx }) => ctx.prisma.activity.create({ data: input })),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      outcome: OUTCOME.optional(),
      notes: z.string().nullable().optional(),
      agentId: z.string().nullable().optional()
    }))
    .mutation(({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.prisma.activity.update({ where: { id }, data });
    })
});
