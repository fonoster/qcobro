import { router } from "./trpc.js";
import { healthRouter } from "./routers/health.js";
import { authRouter } from "./routers/auth.js";

export const appRouter = router({
  health: healthRouter,
  auth: authRouter
});

export type AppRouter = typeof appRouter;
