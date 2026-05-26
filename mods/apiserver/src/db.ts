import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaLibSQL } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_URL ?? "./prisma/qcobro.db";
const sqlite = new Database(dbPath);
const adapter = new PrismaLibSQL(sqlite);

export const prisma = new PrismaClient({ adapter } as never);
