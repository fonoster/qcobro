import { readFileSync } from "node:fs";
import { Client } from "@qcobro/sdk";

/**
 * Voice e2e support: a workspace set up through the SDK, and the Fonoster fake's control API
 * (mods/fonoster-fake/README.md). The fake is shared by every test and every file, so a test
 * only ever reads the calls to its own numbers and the app its own template synced.
 */

export const API = "http://localhost:3000";
export const FAKE = "http://fonoster-fake:8080";

/** What the caller says in a scripted call that ends with a payment promise. */
export const PROMISE_TEXT = "Le pago mañana la cuota.";

/** How long the outcome decision (which runs after the webhook response) may take. */
const DECISION_TIMEOUT_MS = 15_000;

export type FakeEventType = "call.ended" | "call.failed" | "call_record.sealed";

export interface FakeDelivery {
  eventId: string;
  type: FakeEventType;
  status: number;
  deliveredAt: string;
}

export interface FakeCall {
  ref: string;
  from: string;
  to: string;
  appRef: string;
  outcome: string;
  state: string;
  deliveries: FakeDelivery[];
}

export interface FakeApplication {
  ref: string;
  type?: string;
  [key: string]: unknown;
}

async function fake<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${FAKE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return JSON.parse(text) as T;
}

/** Queue the next call to `to`: answered with these caller lines, or busy. */
export function scriptCall(
  to: string,
  script: { outcome: "answered"; callerText: string } | { outcome: "busy" }
) {
  return fake<{ to: string; queued: number }>("POST", "/_fake/calls/script", {
    to,
    outcome: script.outcome,
    ...(script.outcome === "answered" && {
      transcript: [
        { role: "agent", text: "Hola, le habla Clara. Le llamo por la cuota pendiente." },
        { role: "caller", text: script.callerText }
      ]
    })
  });
}

/** Hang up a call: the fake posts its signed events and answers after the last one. */
export function completeCall(ref: string, order?: FakeEventType[]) {
  return fake<{ ref: string; state: string; deliveries: FakeDelivery[] }>(
    "POST",
    `/_fake/calls/${encodeURIComponent(ref)}/complete`,
    order ? { order } : {}
  );
}

/** Post one of a call's events again: same id and body, fresh signature. */
export function redeliverEvent(ref: string, eventId: string) {
  return fake<FakeDelivery>("POST", `/_fake/calls/${encodeURIComponent(ref)}/redeliver`, {
    eventId
  });
}

/** The calls the fake placed to `to` (never the whole list: other tests share the fake). */
export function callsTo(to: string) {
  return fake<FakeCall[]>("GET", `/_fake/calls?to=${encodeURIComponent(to)}`);
}

/** The fake's application with this ref, if the sync created one. */
export async function fakeApplication(ref: string) {
  const apps = await fake<FakeApplication[]>("GET", "/_fake/applications");
  return apps.find((app) => app.ref === ref);
}

/** The caller-ID numbers this deployment dials from (`fonoster.numbers` in the dev config). */
export function configuredNumbers(): string[] {
  const path = process.env.QCOBRO_CONFIG;
  if (!path) throw new Error("QCOBRO_CONFIG is not set: run the e2e suite in the dev container");
  const config = JSON.parse(readFileSync(path, "utf8")) as { fonoster?: { numbers?: string[] } };
  return config.fonoster?.numbers ?? [];
}

/** A destination number no other test or run uses. */
export function uniquePhone(): string {
  const digits = `${Date.now()}${Math.floor(Math.random() * 1e3)}`.slice(-7);
  return `+1829${digits}`;
}

/** Poll `read` until `done` holds, or throw with `describe` of the last value. */
export async function waitFor<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  describe: (value: T) => string,
  timeoutMs = DECISION_TIMEOUT_MS
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!done(value)) {
    if (Date.now() > deadline)
      throw new Error(`Timed out after ${timeoutMs} ms: ${describe(value)}`);
    await new Promise((r) => setTimeout(r, 250));
    value = await read();
  }
  return value;
}

/**
 * Sign up a new owner, create a workspace and a portfolio through the SDK, and return a client
 * acting in that workspace.
 */
export async function newVoiceWorkspace(tag: string) {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const email = `${tag}+${unique}@qcobro.com`;
  const password = "test1234";

  const client = new Client({ endpoint: API });
  await client.trpc.auth.signUp.mutate({ name: "QA Voz", email, password });
  await client.login({ email, password });

  const created = await client.trpc.workspaces.create.mutate({
    name: `Voz ${unique}`,
    currency: "DOP",
    timezone: "America/Santo_Domingo"
  });
  // The access token names the workspaces the user belonged to when it was issued: refresh it,
  // as the console does after creating one.
  await client.refresh();
  const workspace = await client.trpc.workspaces.get.query({ ref: created.ref });
  client.useWorkspace(workspace.accessKeyId);

  const portfolio = await client.portfolios.create({
    name: `Cartera ${unique}`,
    clientId: `cli-${unique}`
  });
  return { client, portfolioId: portfolio.id };
}

/** Import one account with this phone; returns its id. */
export async function addAccount(client: Client, portfolioId: string, phone: string) {
  const externalId = `ext-${phone.slice(1)}`;
  await client.portfolios.syncAccounts({
    portfolioId,
    mode: "APPEND_ONLY",
    rows: [
      {
        externalId,
        fullName: "María Voz",
        phone,
        outstandingBalance: 4820,
        termsAmount: 1200,
        missedInstallments: 2,
        daysPastDue: 30
      }
    ]
  });
  const { items } = await client.portfolios.listAccounts({ portfolioId, limit: 200 });
  const account = items.find((a) => a.externalId === externalId);
  if (!account) throw new Error(`Account ${externalId} was not imported`);
  return account.id;
}

/** Create a VOICE_AI template through the SDK and return it as stored, with its sync result. */
export async function createVoiceAiTemplate(client: Client) {
  const voices = await client.trpc.config.voices.query();
  const created = await client.agentTemplates.create({
    type: "VOICE_AI",
    name: `Voz IA ${Date.now()}`,
    voice: voices[0]?.id ?? "86V9x9hrQds83qf7zaGn",
    language: "es-419",
    systemPrompt: "Eres Clara, agente de cobros. Pide una fecha de pago para la cuota pendiente.",
    firstMessage: "Hola, le habla Clara."
  });
  const template = await client.agentTemplates.get({ id: created.id });
  return { id: template.id, appRef: template.voiceAiConfig?.fonosterAppRef ?? null };
}

/** The fields of a gestión (`campaigns.contactLog.get`) these tests assert on. */
export interface Gestion {
  id: string;
  agentType: string;
  delivery: string;
  deliveryReason: string | null;
  path: string | null;
  outcome: string | null;
  providerRef: string | null;
  paymentPromises: { status: string }[];
}

/** The gestión this call created, read through `campaigns.contactLog`. */
export async function gestionByCallRef(client: Client, callRef: string): Promise<Gestion | null> {
  const { items } = await client.trpc.campaigns.contactLog.list.query({
    agentType: "VOICE_AI",
    limit: 200
  });
  const match = items.find((g) => g.providerRef === callRef);
  if (!match) return null;
  return client.trpc.campaigns.contactLog.get.query({ id: match.id });
}

/** The account's payment promises, read through `campaigns.paymentPromise`. */
export async function promisesFor(client: Client, portfolioAccountId: string) {
  const all = await client.trpc.campaigns.paymentPromise.list.query();
  return all.filter((p) => p.portfolioAccountId === portfolioAccountId);
}

function describeGestion(g: Gestion | null) {
  if (!g) return "no gestión";
  return `gestión ${g.id} delivery=${g.delivery} deliveryReason=${g.deliveryReason} path=${g.path} outcome=${g.outcome} promises=${g.paymentPromises.length}`;
}

/** Wait until the call's gestión matches `done`; throws with its state otherwise. */
export function waitForGestion(client: Client, callRef: string, done: (g: Gestion) => boolean) {
  return waitFor(
    () => gestionByCallRef(client, callRef),
    (g) => !!g && done(g),
    describeGestion
  ).then((g) => g!);
}

/**
 * Script the fake so the next call to `phone` is answered and the caller says
 * "Le pago mañana la cuota.", dispatch `agentTemplateId` to the account, wait for the gestión
 * with providerRef = callRef, hang the call up, then wait (≤ 15 s) until the gestión has
 * outcome PAYMENT_PROMISE and a PENDING promise exists for the account. Throws with the
 * gestión's state otherwise.
 */
export async function scriptPromiseCall(
  client: Client,
  opts: {
    portfolioAccountId: string;
    phone: string;
    agentTemplateId: string;
    /** Event order for the hang-up; the fake's default when omitted. */
    order?: FakeEventType[];
  }
): Promise<{ callRef: string; contactLogId: string }> {
  await scriptCall(opts.phone, { outcome: "answered", callerText: PROMISE_TEXT });
  const dispatched = await client.trpc.outreach.dispatch.mutate({
    portfolioAccountId: opts.portfolioAccountId,
    agentTemplateId: opts.agentTemplateId
  });
  const callRef = dispatched.providerRef;
  if (!callRef) throw new Error("outreach.dispatch returned no providerRef");

  const dispatchedGestion = await waitForGestion(client, callRef, () => true);
  await completeCall(callRef, opts.order);

  const gestion = await waitFor(
    async () => ({
      gestion: await gestionByCallRef(client, callRef),
      promises: await promisesFor(client, opts.portfolioAccountId)
    }),
    ({ gestion, promises }) =>
      gestion?.outcome === "PAYMENT_PROMISE" && promises.some((p) => p.status === "PENDING"),
    ({ gestion, promises }) =>
      `${describeGestion(gestion)}; account promises=${promises.map((p) => p.status).join(",") || "none"}`
  );
  return { callRef, contactLogId: gestion.gestion?.id ?? dispatchedGestion.id };
}
