/**
 * TEMPORARY smoke test for AI-insight generation. Loads the `ai` config from
 * qcobro.json, builds the insight generator (key sourced per provider from the
 * Fonoster integrations file), and analyzes a sample transcript — printing the
 * structured result. Hits the live provider. Delete once verified.
 *
 *   npx tsx scripts/smoke-insight.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { qcobroConfigSchema, type TranscriptLine } from "@qcobro/common";
import { createInsightGenerator } from "../mods/apiserver/src/services/insightGenerator.ts";

const transcript: TranscriptLine[] = [
  { role: "agent", text: "Buenas tardes, le llamo de QCobro respecto a su saldo pendiente." },
  { role: "customer", text: "Sí, sé que debo, pero ando corto de dinero este mes." },
  { role: "agent", text: "Entiendo. ¿Podría hacer al menos un pago parcial esta semana?" },
  { role: "customer", text: "Puedo pagar la mitad el viernes cuando cobre mi salario." },
  { role: "agent", text: "Perfecto, registro su compromiso de pago parcial para el viernes." }
];

async function main() {
  const config = qcobroConfigSchema.parse(
    JSON.parse(readFileSync(resolve(process.cwd(), "qcobro.json"), "utf8"))
  );
  const generator = createInsightGenerator(config.ai);
  if (!generator) {
    console.log("AI insights are disabled (no enabled `ai` config).");
    return;
  }
  console.log(`Provider: ${config.ai?.provider} · model: ${config.ai?.model}\n`);
  const insight = await generator.analyze({
    transcript,
    language: "es",
    context: { customerName: "Marino Del Monte", outstandingBalance: 4800 }
  });
  console.log(JSON.stringify(insight, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
