import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL ?? "file:./prisma/qcobro.db";
const adapter = new PrismaBetterSqlite3({ url });

export const prisma = new PrismaClient({ adapter } as never);
