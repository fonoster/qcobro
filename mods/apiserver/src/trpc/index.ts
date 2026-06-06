import { router } from "./trpc.js";
import { healthRouter } from "./routers/health.js";

export const appRouter = router({
  health: healthRouter
});

export type AppRouter = typeof appRouter;
