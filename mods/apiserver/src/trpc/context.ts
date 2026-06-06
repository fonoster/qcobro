import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { prisma } from "../db.js";
import { createIdentityClient } from "../identity/client.js";

export interface AuthedUser {
  id: string;
  email: string;
  role: string;
}

// Shared singletons reached by procedures through the context.
const identity = createIdentityClient();

/**
 * Builds the per-request tRPC context.
 *
 * The context is how procedures reach the shared services they depend on. Today
 * that is the Prisma client; telephony (Fonoster) and other third-party clients
 * will be added here too, rather than constructed inside procedures, so they
 * stay injectable and testable.
 *
 * Authentication is deferred to a later change. The bearer-token seam is read
 * here so that change can resolve `user`; until then the token is captured but
 * every request is treated as unauthenticated (`user` is null).
 */
export async function createContext(opts: CreateExpressContextOptions) {
  const token = opts.req.headers.authorization?.replace("Bearer ", "") ?? null;
  const user: AuthedUser | null = null;
  return { token, user, prisma, identity };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
