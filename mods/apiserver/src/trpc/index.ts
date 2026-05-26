import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.js";
import { carterasRouter } from "./routers/carteras.js";
import { campanasRouter } from "./routers/campanas.js";
import { gestionesRouter } from "./routers/gestiones.js";
import { promesasRouter } from "./routers/promesas.js";
import { agentesRouter } from "./routers/agentes.js";
import { rendimientoRouter } from "./routers/rendimiento.js";
import { usersRouter } from "./routers/users.js";

export const appRouter = router({
  auth: authRouter,
  carteras: carterasRouter,
  campanas: campanasRouter,
  gestiones: gestionesRouter,
  promesas: promesasRouter,
  agentes: agentesRouter,
  rendimiento: rendimientoRouter,
  users: usersRouter
});

export type AppRouter = typeof appRouter;
