import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "file:./prisma/qcobro.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter } as never);

async function main() {
  const passwordHash = await bcrypt.hash("admin1234", 12);
  await prisma.user.upsert({
    where: { email: "admin@qcobro.com" },
    update: {},
    create: { email: "admin@qcobro.com", nombre: "Admin", rol: "ADMIN", passwordHash }
  });
  console.log("Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
