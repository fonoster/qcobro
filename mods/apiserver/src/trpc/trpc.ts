import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create({
  // Surface a machine-readable category on every error so clients can branch
  // on the failure type without parsing message strings.
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        category: error.code
      }
    };
  }
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires an authenticated user. Narrows `user` and `token` to non-null. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.token) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user, token: ctx.token } });
});

/**
 * Requires an authenticated user with an active workspace they belong to.
 * Narrows `ctx.workspace` to non-null for downstream procedures.
 */
export const workspaceProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.workspace) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active workspace; the user is not a member of the requested workspace"
    });
  }
  return next({ ctx: { ...ctx, workspace: ctx.workspace } });
});

const ADMIN_ROLES = new Set(["WORKSPACE_OWNER", "WORKSPACE_ADMIN"]);

/** Requires the caller to be an owner or admin of the active workspace. */
export const adminProcedure = workspaceProcedure.use(({ ctx, next }) => {
  if (!ADMIN_ROLES.has(ctx.workspace.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Requires workspace owner or admin role"
    });
  }
  return next();
});
