import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { jwtVerify } from "jose";
import { prisma } from "../db.js";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "change-me-in-production");

export async function createContext({ req }: CreateExpressContextOptions) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  let user: { id: string; email: string; role: string } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      user = payload as { id: string; email: string; role: string };
    } catch {
      // invalid token — unauthenticated request
    }
  }

  return { user, prisma };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
