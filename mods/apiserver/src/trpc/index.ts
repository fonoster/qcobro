import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.js";
import { portfoliosRouter } from "./routers/portfolios.js";
import { campaignsRouter } from "./routers/campaigns.js";
import { activitiesRouter } from "./routers/activities.js";
import { commitmentsRouter } from "./routers/commitments.js";
import { agentsRouter } from "./routers/agents.js";
import { performanceRouter } from "./routers/performance.js";
import { usersRouter } from "./routers/users.js";
import { callsRouter } from "./routers/calls.js";

export const appRouter = router({
  auth: authRouter,
  portfolios: portfoliosRouter,
  campaigns: campaignsRouter,
  activities: activitiesRouter,
  commitments: commitmentsRouter,
  agents: agentsRouter,
  performance: performanceRouter,
  users: usersRouter,
  calls: callsRouter
});

export type AppRouter = typeof appRouter;
