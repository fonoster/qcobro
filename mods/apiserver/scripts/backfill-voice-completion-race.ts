/**
 * Backfill: corrects VOICE_AI / VOICE_PRERECORDED gestiones that were marked
 * `entrega: FAILED, deliveryReason: PROVIDER_ERROR` by `voiceCompletionTimeoutSweep`
 * racing the real completion signal (see `recordVoiceAiCallStatus` /
 * `recordPrerecordedOutcome`), even though the call actually connected.
 *
 * Two independent signals prove a "FAILED" row was really answered, since neither can
 * exist unless the call connected:
 *   - VOICE_AI: a transcript/analysis was produced (`camino = 'ENGAGED'`, a non-null
 *     `aiSummary`, or a stored `channelData.transcript`) — both `decideVoiceOutcome` and
 *     `generateGestionInsight` require a real transcript before writing either.
 *   - VOICE_PRERECORDED: a nonzero `durationSeconds`, or a stored
 *     `channelData.scriptDurationSeconds`/`repeatCount` — all three are written only by a
 *     genuine VoiceServer completion (`recordPrerecordedOutcome`'s finalize branch), never
 *     by the sweep (which always reports zero).
 *
 * Usage (dry run by default — prints what would change, writes nothing):
 *   npm run voice:backfill-race --workspace=mods/apiserver
 *   npm run voice:backfill-race --workspace=mods/apiserver -- --apply
 *
 * For VOICE_AI, `durationSeconds` is re-derived from `channelData.startedAt`/`endedAt`
 * when both are present (the real ring-to-hangup span); otherwise it is left as whatever
 * the sweep last wrote (usually 0) rather than guessed. `deliveryReason` is cleared either
 * way — it no longer applies once `entrega` moves to `DELIVERED`.
 */
import { prisma } from "../src/db.js";

const APPLY = process.argv.includes("--apply");

interface VoiceAiRow {
  id: string;
  durationSeconds: number | null;
  channelData: { startedAt?: string; endedAt?: string } | null;
}

interface PrerecordedRow {
  id: string;
  durationSeconds: number | null;
}

async function backfillVoiceAi(): Promise<number> {
  const rows = await prisma.$queryRaw<VoiceAiRow[]>`
    SELECT id, "durationSeconds", "channelData"
    FROM account_contact_logs
    WHERE "agentType" = 'VOICE_AI'
      AND entrega = 'FAILED' AND "deliveryReason" = 'PROVIDER_ERROR'
      AND (camino = 'ENGAGED' OR "aiSummary" IS NOT NULL OR "channelData" ? 'transcript')
  `;

  console.log(`\nVOICE_AI: ${rows.length} mislabeled row(s) found.`);
  for (const row of rows) {
    const started = row.channelData?.startedAt ? Date.parse(row.channelData.startedAt) : NaN;
    const ended = row.channelData?.endedAt ? Date.parse(row.channelData.endedAt) : NaN;
    const derivedDuration =
      Number.isFinite(started) && Number.isFinite(ended) && ended > started
        ? Math.round((ended - started) / 1000)
        : null;
    const nextDuration = derivedDuration ?? row.durationSeconds ?? 0;

    console.log(
      `  ${row.id}: durationSeconds ${row.durationSeconds} -> ${nextDuration}` +
        (derivedDuration != null ? " (derived from channelData timestamps)" : " (left as-is)")
    );

    if (APPLY) {
      await prisma.$executeRaw`
        UPDATE account_contact_logs
        SET entrega = 'DELIVERED', "deliveryReason" = NULL, "durationSeconds" = ${nextDuration}
        WHERE id = ${row.id}
      `;
    }
  }
  return rows.length;
}

async function backfillPrerecorded(): Promise<number> {
  const rows = await prisma.$queryRaw<PrerecordedRow[]>`
    SELECT id, "durationSeconds"
    FROM account_contact_logs
    WHERE "agentType" = 'VOICE_PRERECORDED'
      AND entrega = 'FAILED' AND "deliveryReason" = 'PROVIDER_ERROR'
      AND ("durationSeconds" > 0 OR "channelData" ? 'scriptDurationSeconds' OR "channelData" ? 'repeatCount')
  `;

  console.log(`\nVOICE_PRERECORDED: ${rows.length} mislabeled row(s) found.`);
  for (const row of rows) {
    console.log(`  ${row.id}: durationSeconds ${row.durationSeconds} (kept as recorded)`);
    if (APPLY) {
      await prisma.$executeRaw`
        UPDATE account_contact_logs
        SET entrega = 'DELIVERED', "deliveryReason" = NULL
        WHERE id = ${row.id}
      `;
    }
  }
  return rows.length;
}

const aiCount = await backfillVoiceAi();
const prerecordedCount = await backfillPrerecorded();

console.log(
  `\n${APPLY ? "Applied" : "Dry run — pass --apply to write"}: ${aiCount + prerecordedCount} row(s) total.`
);

await prisma.$disconnect();
