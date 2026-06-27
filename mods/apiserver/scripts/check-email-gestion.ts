/**
 * TEMPORARY: print an EMAIL gestión's stored thread + analysis, to verify an inbound
 * reply was captured (body present, not empty) after replying to a test email.
 *
 * Usage:
 *   npm run email:check --workspace=mods/apiserver -- --id=<gestiónId>
 *   npm run email:check --workspace=mods/apiserver -- --to=sanderspedro@gmail.com   (latest EMAIL gestión for that address)
 */

import { PrismaClient } from "@prisma/client";
import { config } from "../src/config.js";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.slice(2).split("=");
      return [k, rest.join("=")];
    })
);

const prisma = new PrismaClient({ datasources: { db: { url: config.database.url } } });

const log = args.id
  ? await prisma.accountContactLog.findUnique({
      where: { id: args.id },
      include: { portfolioAccount: true, objectives: true }
    })
  : await prisma.accountContactLog.findFirst({
      where: {
        agentType: "EMAIL",
        ...(args.to ? { portfolioAccount: { email: args.to } } : {})
      },
      include: { portfolioAccount: true, objectives: true },
      orderBy: { createdAt: "desc" }
    });

await prisma.$disconnect();

if (!log) {
  console.error("❌  No matching EMAIL gestión found.");
  process.exit(1);
}

const cd = (log.channelData ?? {}) as {
  from?: string;
  to?: string;
  subject?: string;
  messageBody?: string;
  emailThread?: { agentReplyCount?: number; messages?: Array<Record<string, unknown>> };
};

console.log(`\n── Gestión ${log.id} ──`);
console.log(`  Account:   ${log.portfolioAccount.fullName} · ${log.portfolioAccount.externalId}`);
console.log(`  Outcome:   ${log.outcome}`);
console.log(`  Subject:   ${cd.subject ?? "—"}`);
console.log(`  Notice:    ${(cd.messageBody ?? "").slice(0, 80)}…`);

const messages = cd.emailThread?.messages ?? [];
console.log(
  `\n  Thread (${messages.length} message(s), agentReplyCount=${cd.emailThread?.agentReplyCount ?? 0}):`
);
if (messages.length === 0) {
  console.log("    (no replies yet)");
} else {
  for (const m of messages) {
    const dir = m.direction as string;
    const body = String(m.body ?? "");
    const flag = dir === "inbound" && body.trim() === "" ? "  ⚠️ EMPTY BODY" : "";
    console.log(`    [${dir}] ${body.slice(0, 200)}${flag}`);
  }
}

console.log(`\n  AI analysis:`);
console.log(`    Summary:  ${log.aiSummary ?? "(none)"}`);
console.log(`    Sentiment:${log.aiSentiment ?? "(none)"}  Result: ${log.aiResult ?? "(none)"}`);

if (log.objectives.length) {
  console.log(`\n  Objectives:`);
  for (const o of log.objectives) {
    console.log(
      `    ${o.type} · amount=${o.amount ?? "—"} · due=${o.dueDate.toISOString().slice(0, 10)} · ${o.status}`
    );
  }
}
console.log("");
