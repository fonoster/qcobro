import { test } from "node:test";
import assert from "node:assert/strict";
import type { EvalEvent } from "@qcobro/common";
import { buildReportModel, renderHtml, renderPdf } from "./evalReport.js";

const meta = new Map<string, { description: string; turnCount: number }>([
  ["s1", { description: "Primer escenario", turnCount: 3 }],
  ["s2", { description: "Segundo escenario", turnCount: 2 }]
]);

const events: EvalEvent[] = [
  {
    type: "turn",
    scenarioRef: "s1",
    result: {
      turnIndex: 0,
      input: "Hola",
      passed: true,
      aiResponse: "Buenas",
      evaluationType: "SIMILAR"
    }
  },
  {
    type: "turn",
    scenarioRef: "s1",
    result: {
      turnIndex: 1,
      input: "Quiero pagar",
      passed: false,
      errorMessage: "no ofreció el enlace de pago",
      expectedResponse: "Aquí tienes el enlace",
      aiResponse: "Adiós",
      evaluationType: "EXACT"
    }
  },
  { type: "turn", scenarioRef: "s1", result: { turnIndex: 2, input: "Gracias" } },
  { type: "scenarioSummary", scenarioRef: "s1", overallPassed: false },
  {
    type: "turn",
    scenarioRef: "s2",
    result: { turnIndex: 0, input: "Buenos días", passed: true, aiResponse: "Hola" }
  },
  { type: "scenarioSummary", scenarioRef: "s2", overallPassed: true },
  {
    type: "summary",
    verdict: "fail",
    scenarios: [
      { ref: "s1", overallPassed: false },
      { ref: "s2", overallPassed: true }
    ]
  }
];

test("buildReportModel folds a stream into a render-ready model", () => {
  const model = buildReportModel(events, meta);

  assert.equal(model.summary.pass, 1);
  assert.equal(model.summary.total, 2);
  assert.equal(model.summary.verdict, "fail");

  // first-seen order is preserved
  assert.deepEqual(
    model.scenarios.map((s) => s.ref),
    ["s1", "s2"]
  );
  assert.equal(model.scenarios[0].description, "Primer escenario");
  assert.equal(model.scenarios[0].passed, false);
  assert.equal(model.scenarios[1].passed, true);

  const failing = model.scenarios[0].turns.find((t) => t.passed === false);
  assert.ok(failing);
  assert.equal(failing.errorMessage, "no ofreció el enlace de pago");
  assert.equal(failing.expected, "Aquí tienes el enlace");
  assert.equal(failing.actual, "Adiós");
  assert.equal(failing.evaluationType, "EXACT");

  // a turn with no expectation is kept, ungraded, and does not by itself fail the scenario
  const ungraded = model.scenarios[0].turns.find((t) => t.index === 2);
  assert.ok(ungraded);
  assert.equal(ungraded.passed, undefined);
  assert.equal(model.errors.length, 0);
});

test("buildReportModel falls back to scenario tallies when no summary event arrives", () => {
  const noSummary: EvalEvent[] = [
    { type: "turn", scenarioRef: "a", result: { turnIndex: 0, input: "hi", passed: true } },
    { type: "scenarioSummary", scenarioRef: "a", overallPassed: true },
    { type: "turn", scenarioRef: "b", result: { turnIndex: 0, input: "yo" } },
    { type: "scenarioSummary", scenarioRef: "b", overallPassed: true }
  ];

  const model = buildReportModel(noSummary, new Map());
  assert.equal(model.summary.total, 2);
  assert.equal(model.summary.pass, 2);
  assert.equal(model.summary.verdict, "pass");
});

test("buildReportModel uses the provided title, trimmed, else a generic default", () => {
  assert.equal(
    buildReportModel([], new Map()).title,
    "Reporte de Evaluación — Agente Conversacional"
  );
  assert.equal(buildReportModel([], new Map(), { title: "  Acme  " }).title, "Acme");
});

test("renderHtml returns one self-contained document", () => {
  const model = buildReportModel(events, meta);
  const html = renderHtml(model);

  assert.ok(html.toLowerCase().startsWith("<!doctype html"));
  assert.ok(html.includes("s1"));
  assert.ok(html.includes("s2"));
  assert.ok(html.includes("FAILED"));
  assert.ok(html.includes("PASSED"));
  assert.ok(html.includes(model.title));
});

test("renderPdf produces a PDF buffer", async () => {
  const model = buildReportModel(events, meta);
  const buf = await renderPdf(model);

  assert.ok(buf.length > 500);
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
});
