import { expect, type Page } from "@playwright/test";

export const MAILPIT = "http://localhost:8025";

export interface Credentials {
  name: string;
  email: string;
  password: string;
}

/** Unique-per-run credentials so parallel/repeat runs never collide. */
export function newOwner(tag = "owner"): Credentials {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  return { name: "QA Owner", email: `${tag}+${unique}@qcobro.com`, password: "test1234" };
}

interface MailpitMessage {
  ID: string;
  Subject: string;
  To?: { Address: string }[];
}

async function listMessages(): Promise<MailpitMessage[]> {
  const res = await fetch(`${MAILPIT}/api/v1/messages`);
  if (!res.ok) return [];
  const data = (await res.json()) as { messages?: MailpitMessage[] };
  return data.messages ?? [];
}

function messagesTo(messages: MailpitMessage[], to: string) {
  return messages.filter((m) => (m.To ?? []).some((t) => t.Address === to));
}

/** Poll Mailpit until at least `count` messages are addressed to `to`. */
export async function waitForMail(to: string, count = 1, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const matching = messagesTo(await listMessages(), to);
    if (matching.length >= count) return matching[0];
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Expected ${count} email(s) to ${to} within ${timeoutMs}ms`);
}

/** Sign up a new account. Leaves the page on the contact-verification screen. */
export async function signUp(page: Page, creds: Credentials) {
  await page.goto("/signup");
  await page.getByPlaceholder("Tu nombre").fill(creds.name);
  await page.getByPlaceholder("tú@empresa.com").fill(creds.email);
  await page.getByPlaceholder("Mínimo 8 caracteres").fill(creds.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/verify-contact/);
}

/** Skip contact verification → routes to workspace creation when none exists. */
export async function skipVerification(page: Page) {
  await page.getByRole("button", { name: "Omitir por ahora" }).click();
  await expect(page).toHaveURL(/\/create-workspace/);
}

/** Create the first workspace from the create-workspace screen → dashboard. */
export async function createFirstWorkspace(page: Page, name: string) {
  await page.getByRole("button", { name: "Nuevo espacio" }).click();
  await page.getByPlaceholder("Ej. Cartera Abril").fill(name);
  await page.getByRole("button", { name: "Crear espacio" }).click();
  await expect(page).toHaveURL(/localhost:5173\/$/);
}

/** Sign up, skip verification, and create a first workspace → dashboard. */
export async function signUpAndEnter(page: Page, creds: Credentials, workspaceName: string) {
  await signUp(page, creds);
  await skipVerification(page);
  await createFirstWorkspace(page, workspaceName);
}

/** Open the user menu and navigate to one of its entries. */
export async function openUserMenu(page: Page, entry: string) {
  await page.getByRole("button", { name: "Menú de usuario" }).click();
  await page.getByRole("button", { name: entry }).click();
}

/** Invite a member from the Members page (assumes already on it). */
export async function inviteMember(page: Page, name: string, email: string) {
  await page.getByRole("button", { name: "Invitar miembro" }).click();
  await page.getByPlaceholder("Nombre de la persona").fill(name);
  await page.getByPlaceholder("persona@empresa.com").fill(email);
  await page.getByRole("button", { name: "Enviar invitación" }).click();
  await expect(page.getByText(email)).toBeVisible();
}
