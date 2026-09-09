import type { EvalEvent } from "@qcobro/common";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";

/**
 * Pure, oclif-free builders for the `agents:eval` html/pdf report. The report is
 * deliberately GENERIC — no customer names, no per-scenario copy, no hardcoded
 * scenario maps — so it is safe to hand to anyone. A caller who wants a client
 * name on the cover passes `--title` at run time.
 */

const DEFAULT_TITLE = "Reporte de Evaluación — Agente Conversacional";
const ACCENT = "#12805a";
const AMBER = "#b45309";

export interface ReportTurn {
  index: number;
  input: string;
  expected?: string;
  actual?: string;
  evaluationType?: "EXACT" | "SIMILAR";
  passed?: boolean;
  errorMessage?: string;
  tools?: Array<{ expected: string; actual?: string; passed: boolean }>;
}

export interface ReportScenario {
  ref: string;
  description: string;
  passed: boolean;
  turns: ReportTurn[];
}

export interface ReportModel {
  title: string;
  generatedAt: string;
  summary: { pass: number; total: number; verdict: "pass" | "fail" };
  scenarios: ReportScenario[];
  errors: string[];
}

/** Walk the streamed events once and fold them into a render-ready model. */
export function buildReportModel(
  events: EvalEvent[],
  scenariosMeta: Map<string, { description: string; turnCount: number }>,
  opts: { title?: string } = {}
): ReportModel {
  const byRef = new Map<string, ReportScenario>();
  const errors: string[] = [];
  let summaryPass: number | undefined;
  let summaryTotal: number | undefined;
  let summaryVerdict: "pass" | "fail" | undefined;

  const ensure = (ref: string): ReportScenario => {
    let scenario = byRef.get(ref);
    if (!scenario) {
      scenario = {
        ref,
        description: scenariosMeta.get(ref)?.description ?? "",
        passed: false,
        turns: []
      };
      byRef.set(ref, scenario);
    }
    return scenario;
  };

  for (const event of events) {
    if (event.type === "turn") {
      const r = event.result;
      ensure(event.scenarioRef).turns.push({
        index: r.turnIndex,
        input: r.input,
        expected: r.expectedResponse,
        actual: r.aiResponse,
        evaluationType: r.evaluationType,
        passed: r.passed,
        errorMessage: r.errorMessage,
        tools: r.toolEvaluations?.map((t) => ({
          expected: t.expectedTool,
          actual: t.actualTool,
          passed: t.passed
        }))
      });
    } else if (event.type === "scenarioSummary") {
      ensure(event.scenarioRef).passed = event.overallPassed;
    } else if (event.type === "summary") {
      summaryVerdict = event.verdict;
      summaryTotal = event.scenarios.length;
      summaryPass = event.scenarios.filter((s) => s.overallPassed).length;
    } else {
      errors.push(event.message);
    }
  }

  const scenarios = [...byRef.values()];
  const summary =
    summaryVerdict !== undefined
      ? { pass: summaryPass ?? 0, total: summaryTotal ?? scenarios.length, verdict: summaryVerdict }
      : (() => {
          const total = scenarios.length;
          const pass = scenarios.filter((s) => s.passed).length;
          const verdict: "pass" | "fail" = pass === total ? "pass" : "fail";
          return { pass, total, verdict };
        })();

  return {
    title: opts.title?.trim() || DEFAULT_TITLE,
    generatedAt: new Date().toISOString(),
    summary,
    scenarios,
    errors
  };
}

/** HTML-escape a value for safe interpolation into the report markup. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn an ISO timestamp into something a human wants to read. */
function readableDate(iso: string): string {
  return `${iso.replace("T", " ").slice(0, 16)} UTC`;
}

function turnRows(turns: ReportTurn[]): string {
  return turns
    .map((turn) => {
      const mark = turn.passed === undefined ? "" : turn.passed ? "✓" : "✗";
      const type = turn.evaluationType
        ? ` <span class="muted">${esc(turn.evaluationType)}</span>`
        : "";
      const err =
        turn.passed === false && turn.errorMessage
          ? `<div class="err">${esc(turn.errorMessage)}</div>`
          : "";
      const main = `<tr>
        <td>${esc(turn.index)}</td>
        <td>${esc(turn.input)}</td>
        <td>${esc(turn.expected ?? "")}</td>
        <td>${esc(turn.actual ?? "")}</td>
        <td>${mark}${type}${err}</td>
      </tr>`;
      if (!turn.tools?.length) return main;
      const tools = turn.tools
        .map(
          (t) =>
            `${t.passed ? "✓" : "✗"} ${esc(t.expected)}${
              t.actual && t.actual !== t.expected ? ` → ${esc(t.actual)}` : ""
            }`
        )
        .join("<br>");
      return `${main}
      <tr class="tools"><td></td><td colspan="4"><strong>Herramientas:</strong><br>${tools}</td></tr>`;
    })
    .join("\n");
}

function scenarioSection(scenario: ReportScenario): string {
  const badgeColor = scenario.passed ? ACCENT : AMBER;
  const badgeText = scenario.passed ? "PASSED" : "FAILED";
  const description = scenario.description
    ? `<p class="muted">${esc(scenario.description)}</p>`
    : "";
  return `<section class="scenario">
    <h2>${esc(scenario.ref)}</h2>
    ${description}
    <p><span class="badge" style="background:${badgeColor}">${badgeText}</span></p>
    <table>
      <thead>
        <tr><th>#</th><th>Entrada</th><th>Esperado</th><th>Obtenido</th><th>Estado</th></tr>
      </thead>
      <tbody>
        ${turnRows(scenario.turns)}
      </tbody>
    </table>
  </section>`;
}

/** Render the model as one self-contained HTML document string. */
export function renderHtml(model: ReportModel): string {
  const errorsSection = model.errors.length
    ? `<section class="errors">
        <h2>Errores</h2>
        <ul>${model.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      </section>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(model.title)}</title>
<style>
  :root { color-scheme: light; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    background: #fff;
    margin: 0;
    padding: 32px 20px;
  }
  .sheet { max-width: 820px; margin: 0 auto; }
  .wordmark { font-size: 20px; font-weight: 700; color: ${ACCENT}; }
  .wordmark .sub { font-weight: 400; color: #6b7280; font-size: 13px; }
  h1 { font-size: 22px; margin: 16px 0 4px; }
  h2 { font-size: 16px; margin: 0 0 6px; }
  .muted { color: #6b7280; }
  .score {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px 20px;
    margin: 20px 0 28px;
  }
  .score .big { font-size: 32px; font-weight: 700; color: ${ACCENT}; }
  .badge {
    display: inline-block;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 2px 8px;
    border-radius: 4px;
  }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; }
  tr.tools td { background: #f9fafb; font-size: 11px; }
  .err { color: ${AMBER}; margin-top: 4px; font-size: 11px; }
  .scenario { margin-bottom: 28px; }
  @media print {
    body { padding: 0; }
    .scenario { break-before: page; }
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="wordmark">QCobro <span class="sub">· producto de Fonoster</span></div>
  <h1>${esc(model.title)}</h1>
  <p class="muted">Generado: ${esc(readableDate(model.generatedAt))}</p>
  <div class="score">
    <div><span class="big">${model.summary.pass}/${model.summary.total}</span> escenarios aprobados</div>
    <div class="muted">Veredicto: ${esc(model.summary.verdict.toUpperCase())}</div>
  </div>
  ${model.scenarios.map(scenarioSection).join("\n")}
  ${errorsSection}
</div>
</body>
</html>`;
}

// pdfmake ships no first-class ESM types for its build entry points; cast through
// `unknown` to a narrow local shape (this adapter is the one pdfmake boundary).
const fontModule = pdfFonts as unknown as {
  vfs?: Record<string, string>;
  pdfMake?: { vfs?: Record<string, string> };
};
const resolvedVfs =
  fontModule.vfs ?? fontModule.pdfMake?.vfs ?? (pdfFonts as unknown as Record<string, string>);
(pdfMake as unknown as { vfs: Record<string, string> }).vfs = resolvedVfs;

function pdfTurnRows(turns: ReportTurn[]): TableCell[][] {
  const rows: TableCell[][] = [];
  for (const turn of turns) {
    // Plain-text markers: pdfmake's bundled Roboto has no ✓/✗ glyphs.
    const mark = turn.passed === undefined ? "—" : turn.passed ? "OK" : "FALLA";
    const status: Content =
      turn.passed === false && turn.errorMessage
        ? {
            stack: [
              { text: `${mark} ${turn.evaluationType ?? ""}`.trim(), color: AMBER },
              { text: turn.errorMessage, fontSize: 7, color: AMBER }
            ]
          }
        : {
            text: `${mark} ${turn.evaluationType ?? ""}`.trim(),
            color: turn.passed === false ? AMBER : turn.passed ? ACCENT : undefined
          };
    rows.push([String(turn.index), turn.input, turn.expected ?? "", turn.actual ?? "", status]);
    if (turn.tools?.length) {
      const toolText = turn.tools
        .map(
          (t) =>
            `${t.passed ? "OK" : "FALLA"} ${t.expected}${
              t.actual && t.actual !== t.expected ? ` -> ${t.actual}` : ""
            }`
        )
        .join("\n");
      rows.push(["", { text: `Herramientas:\n${toolText}`, colSpan: 4, fontSize: 7 }, {}, {}, {}]);
    }
  }
  return rows;
}

function pdfScenario(scenario: ReportScenario, index: number): Content[] {
  const body: TableCell[][] = [
    [
      { text: "#", bold: true },
      { text: "Entrada", bold: true },
      { text: "Esperado", bold: true },
      { text: "Obtenido", bold: true },
      { text: "Estado", bold: true }
    ],
    ...pdfTurnRows(scenario.turns)
  ];
  return [
    { text: scenario.ref, style: "h2", pageBreak: index > 0 ? "before" : undefined },
    ...(scenario.description
      ? [{ text: scenario.description, color: "#6b7280", margin: [0, 0, 0, 2] } as Content]
      : []),
    {
      text: scenario.passed ? "PASSED" : "FAILED",
      bold: true,
      color: scenario.passed ? ACCENT : AMBER,
      margin: [0, 0, 0, 4]
    },
    {
      table: { headerRows: 1, widths: ["auto", "*", "*", "*", "auto"], body },
      layout: "lightHorizontalLines"
    }
  ];
}

/** Render the model as a PDF document. */
export function renderPdf(model: ReportModel): Promise<Buffer> {
  const content: Content[] = [
    {
      stack: [
        { text: "QCobro", color: ACCENT, bold: true, fontSize: 14 },
        { text: model.title, fontSize: 13 },
        { text: `Generado: ${readableDate(model.generatedAt)}`, fontSize: 8, color: "#6b7280" }
      ],
      margin: [0, 0, 0, 10]
    },
    {
      text:
        `${model.summary.pass}/${model.summary.total} escenarios aprobados · ` +
        `veredicto: ${model.summary.verdict}`,
      margin: [0, 0, 0, 12]
    },
    ...model.scenarios.flatMap((scenario, index) => pdfScenario(scenario, index))
  ];

  if (model.errors.length) {
    content.push({ text: "Errores", style: "h2", margin: [0, 12, 0, 4] });
    content.push({ ul: model.errors });
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 50, 40, 40],
    defaultStyle: { fontSize: 8 },
    styles: { h2: { fontSize: 11, bold: true, margin: [0, 8, 0, 4] } },
    content
  };

  return new Promise<Buffer>((resolve, reject) => {
    try {
      pdfMake.createPdf(docDefinition).getBuffer((buf: Buffer) => resolve(Buffer.from(buf)));
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
