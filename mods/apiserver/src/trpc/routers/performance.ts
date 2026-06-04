import { router, protectedProcedure } from "../trpc.js";

export const performanceRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [portfolios, campaigns, allActivities, commitments, agents, recentActivity, todayCommitments] =
      await ctx.prisma.$transaction([
        ctx.prisma.portfolio.findMany(),
        ctx.prisma.campaign.findMany({ where: { status: "IN_PROGRESS" } }),
        ctx.prisma.activity.findMany(),
        ctx.prisma.commitment.findMany(),
        ctx.prisma.agent.findMany({ where: { status: "ACTIVE" } }),
        ctx.prisma.activity.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { campaign: { select: { name: true } } }
        }),
        ctx.prisma.commitment.findMany({ where: { createdAt: { gte: today } } })
      ]);

    const totalAmount = portfolios.reduce((s: number, p: { totalAmount: number }) => s + p.totalAmount, 0);
    const recoveredAmount = portfolios.reduce((s: number, p: { recoveredAmount: number }) => s + p.recoveredAmount, 0);
    const recoveryRate = totalAmount > 0 ? (recoveredAmount / totalAmount) * 100 : 0;

    const contacted = allActivities.filter((a) =>
      ["CONTACTED", "PROMISE"].includes(a.outcome)
    ).length;
    const contactRate = allActivities.length > 0 ? (contacted / allActivities.length) * 100 : 0;

    const pendingCommitments = commitments.filter((p: { status: string }) => p.status === "PENDING").length;
    const fulfilledCommitments = commitments.filter((p: { status: string }) => p.status === "FULFILLED").length;

    return {
      kpis: {
        totalActivities: allActivities.length,
        totalAmount,
        recoveredAmount,
        recoveryRate,
        activeCampaigns: campaigns.length,
        activeAgents: agents.length,
        contactRate,
        pendingPromises: pendingCommitments,
        fulfilledPromises: fulfilledCommitments,
        todayPromises: todayCommitments.length,
        totalPortfolios: portfolios.length
      },
      recentActivity
    };
  }),

  byAgent: protectedProcedure.query(async ({ ctx }) => {
    const agents = await ctx.prisma.agent.findMany({ orderBy: { recovered: "desc" } });
    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      calls: a.calls,
      promises: a.promises,
      recovered: a.recovered,
      successRate: a.successRate,
      strategy: a.strategy
    }));
  }),

  trends: protectedProcedure.query(async ({ ctx }) => {
    const activities = await ctx.prisma.activity.findMany({
      orderBy: { createdAt: "asc" }
    });

    const byDay = new Map<string, { contacted: number; total: number }>();
    for (const a of activities) {
      const day = a.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(day) ?? { contacted: 0, total: 0 };
      cur.total++;
      if (["CONTACTED", "PROMISE"].includes(a.outcome)) cur.contacted++;
      byDay.set(day, cur);
    }

    return Array.from(byDay.entries()).map(([date, { contacted, total }]) => ({
      date,
      contacted,
      total,
      rate: total > 0 ? Math.round((contacted / total) * 100) : 0
    }));
  })
});
