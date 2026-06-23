import { router } from "./trpc.js";
import { healthRouter } from "./routers/health.js";
import { authRouter } from "./routers/auth.js";
import { workspacesRouter } from "./routers/workspaces.js";
import { profileRouter } from "./routers/profile.js";
import { portfoliosRouter } from "./routers/portfolios.js";
import { agentTemplatesRouter } from "./routers/agentTemplates.js";
import { campaignsRouter } from "./routers/campaigns.js";
import { configRouter } from "./routers/config.js";

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  workspaces: workspacesRouter,
  profile: profileRouter,
  portfolios: portfoliosRouter,
  agentTemplates: agentTemplatesRouter,
  campaigns: campaignsRouter,
  config: configRouter
});

export type AppRouter = typeof appRouter;
