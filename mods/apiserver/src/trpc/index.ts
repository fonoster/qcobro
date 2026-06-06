import { router } from "./trpc.js";
import { healthRouter } from "./routers/health.js";
import { authRouter } from "./routers/auth.js";
import { workspacesRouter } from "./routers/workspaces.js";

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  workspaces: workspacesRouter
});

export type AppRouter = typeof appRouter;
