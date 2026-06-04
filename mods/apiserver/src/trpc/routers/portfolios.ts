import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

const AccountRowSchema = z.object({
  externalId: z.string().min(1),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  preferredLanguage: z.string().optional(),
  bestTimeToCall: z.string().optional(),
  customerSegment: z.string().optional(),
  principalAmount: z.number().nonnegative().default(0),
  termsAmount: z.number().nonnegative().default(0),
  termsFrequency: z.string().optional(),
  termsLength: z.number().int().nonnegative().default(0),
  outstandingBalance: z.number().nonnegative().default(0),
  daysPastDue: z.number().int().nonnegative().default(0),
  missedInstallments: z.number().int().nonnegative().default(0),
  lastPaymentDate: z.string().optional(),
  lastPaymentAmount: z.number().nonnegative().optional(),
  negotiationOptions: z.string().optional()
});

export const portfoliosRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.enum(["ACTIVE", "CLOSED"]).optional() }).optional())
    .query(({ input, ctx }) =>
      ctx.prisma.portfolio.findMany({
        where: input?.status ? { status: input.status } : undefined,
        orderBy: { createdAt: "desc" }
      })
    ),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input, ctx }) =>
      ctx.prisma.portfolio.findUniqueOrThrow({
        where: { id: input.id },
        include: { campaigns: { orderBy: { createdAt: "desc" } } }
      })
    ),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      clientId: z.string().min(1),
      totalAmount: z.number().nonnegative(),
      accounts: z.number().int().nonnegative().default(0)
    }))
    .mutation(({ input, ctx }) =>
      ctx.prisma.portfolio.create({ data: { ...input, recoveredAmount: 0, status: "ACTIVE" } })
    ),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      status: z.enum(["ACTIVE", "CLOSED"]).optional(),
      accounts: z.number().int().nonnegative().optional(),
      totalAmount: z.number().nonnegative().optional(),
      recoveredAmount: z.number().nonnegative().optional()
    }))
    .mutation(({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.prisma.portfolio.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input, ctx }) => ctx.prisma.portfolio.delete({ where: { id: input.id } })),

  listAccounts: protectedProcedure
    .input(z.object({
      portfolioId: z.string(),
      limit: z.number().int().default(50),
      offset: z.number().int().default(0)
    }))
    .query(async ({ input, ctx }) => {
      const [items, total] = await ctx.prisma.$transaction([
        ctx.prisma.account.findMany({
          where: { portfolioId: input.portfolioId },
          orderBy: { fullName: "asc" },
          take: input.limit,
          skip: input.offset
        }),
        ctx.prisma.account.count({ where: { portfolioId: input.portfolioId } })
      ]);
      return { items, total };
    }),

  syncAccounts: protectedProcedure
    .input(z.object({
      portfolioId: z.string(),
      mode: z.enum(["APPEND_ONLY", "UPDATE_EXISTING", "REPLACE"]),
      rows: z.array(AccountRowSchema)
    }))
    .mutation(async ({ input, ctx }) => {
      const { portfolioId, mode, rows } = input;

      return ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.account.findMany({
          where: { portfolioId },
          select: { externalId: true }
        });
        const existingIds = new Set(existing.map((a) => a.externalId));
        const incomingIds = new Set(rows.map((r) => r.externalId));

        let created = 0, updated = 0, deleted = 0;

        for (const row of rows) {
          const { externalId, lastPaymentDate, ...rest } = row;
          const data = {
            ...rest,
            lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null
          };

          if (!existingIds.has(externalId)) {
            await tx.account.create({ data: { portfolioId, externalId, ...data } });
            created++;
          } else if (mode === "UPDATE_EXISTING" || mode === "REPLACE") {
            await tx.account.update({
              where: { portfolioId_externalId: { portfolioId, externalId } },
              data
            });
            updated++;
          }
        }

        if (mode === "REPLACE") {
          const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
          if (toDelete.length > 0) {
            const result = await tx.account.deleteMany({
              where: { portfolioId, externalId: { in: toDelete } }
            });
            deleted = result.count;
          }
        }

        const [newTotal, balanceAgg] = await Promise.all([
          tx.account.count({ where: { portfolioId } }),
          tx.account.aggregate({ where: { portfolioId }, _sum: { outstandingBalance: true } })
        ]);

        await tx.portfolio.update({
          where: { id: portfolioId },
          data: { accounts: newTotal, totalAmount: balanceAgg._sum.outstandingBalance ?? 0 }
        });

        return { created, updated, deleted, total: newTotal };
      });
    })
});
