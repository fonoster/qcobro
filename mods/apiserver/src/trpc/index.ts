import { router } from "./trpc.js";
import { healthRouter } from "./routers/health.js";
import { authRouter } from "./routers/auth.js";
import { workspacesRouter } from "./routers/workspaces.js";
import { profileRouter } from "./routers/profile.js";

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  workspaces: workspacesRouter,
  profile: profileRouter
});

export type AppRouter = typeof appRouter;
