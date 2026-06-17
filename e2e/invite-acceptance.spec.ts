import { test, expect } from "@playwright/test";
import {
  newOwner,
  signUpAndEnter,
  openUserMenu,
  inviteMember,
  waitForMail,
  messageBody,
  extractInviteLink,
  extractOneTimePassword,
  logIn
} from "./helpers.js";

test.describe("invite acceptance", () => {
  test("existing user accepts invite and sees the workspace", async ({ browser }) => {
    const unique = Date.now();
    const owner = newOwner();
    const member = newOwner("member");

    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await signUpAndEnter(ownerPage, owner, `Owner Workspace ${unique}`);

    // Member creates their own account independently.
    const memberCtx = await browser.newContext();
    const memberPage = await memberCtx.newPage();
    await signUpAndEnter(memberPage, member, `Member Workspace ${unique}`);

    // Owner invites the existing member.
    await openUserMenu(ownerPage, "Miembros");
    await inviteMember(ownerPage, member.name, member.email);
    const mail = await waitForMail(member.email, 1);
    const body = await messageBody(mail.ID);
    const inviteLink = extractInviteLink(body);
    expect(inviteLink).toBeTruthy();

    // Member visits the invite link while already logged in and accepts.
    await memberPage.goto(inviteLink!);
    await expect(memberPage.getByRole("heading", { name: /invitaron/ })).toBeVisible();
    await memberPage.getByRole("button", { name: "Aceptar invitación" }).click();

    // Redirects to home (already authenticated).
    await expect(memberPage).toHaveURL(/localhost:5173\/$/);

    // The invited workspace appears in the member's workspace switcher.
    await memberPage.reload();
    await expect(memberPage.getByText(`Owner Workspace ${unique}`)).toBeVisible();

    // Owner's members list shows the member as Activo.
    await ownerPage.reload();
    await openUserMenu(ownerPage, "Miembros");
    await expect(ownerPage.getByText(member.email)).toBeVisible();
    await expect(ownerPage.getByText("Activo").last()).toBeVisible();

    await ownerCtx.close();
    await memberCtx.close();
  });

  test("new user accepts invite then logs in and sees the workspace", async ({ browser }) => {
    const unique = Date.now();
    const owner = newOwner();
    const newMemberEmail = `new+${unique}@qcobro.com`;

    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await signUpAndEnter(ownerPage, owner, `Owner Workspace ${unique}`);

    await openUserMenu(ownerPage, "Miembros");
    await inviteMember(ownerPage, "QA New Member", newMemberEmail);
    const mail = await waitForMail(newMemberEmail, 1);
    const body = await messageBody(mail.ID);
    const inviteLink = extractInviteLink(body);
    const oneTimePassword = extractOneTimePassword(body);
    expect(inviteLink).toBeTruthy();
    expect(oneTimePassword).toBeTruthy();

    // New user visits the invite link in a fresh (unauthenticated) context.
    const newMemberCtx = await browser.newContext();
    const newMemberPage = await newMemberCtx.newPage();
    await newMemberPage.goto(inviteLink!);
    await expect(newMemberPage.getByRole("heading", { name: /invitaron/ })).toBeVisible();
    await newMemberPage.getByRole("button", { name: "Aceptar invitación" }).click();

    // Redirects to /login (unauthenticated).
    await expect(newMemberPage).toHaveURL(/\/login/);

    // Log in with the one-time password from the email. Login navigates to /
    // directly; the invited workspace (now ACTIVE) keeps them out of /create-workspace.
    await logIn(newMemberPage, newMemberEmail, oneTimePassword!);
    await expect(newMemberPage).toHaveURL(/localhost:5173\/$/);

    // The invited workspace appears in the workspace switcher.
    await expect(newMemberPage.getByText(`Owner Workspace ${unique}`)).toBeVisible();

    await ownerCtx.close();
    await newMemberCtx.close();
  });

  test("invited member has the correct role after acceptance", async ({ browser }) => {
    const unique = Date.now();
    const owner = newOwner();
    const member = newOwner("rolemember");

    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await signUpAndEnter(ownerPage, owner, `Role Workspace ${unique}`);

    // Invite member with the default (WORKSPACE_MEMBER) role.
    await openUserMenu(ownerPage, "Miembros");
    await inviteMember(ownerPage, member.name, member.email);
    const mail = await waitForMail(member.email, 1);
    const body = await messageBody(mail.ID);
    const inviteLink = extractInviteLink(body);
    expect(inviteLink).toBeTruthy();

    // Accept the invitation in a new context (simulates clicking the email link).
    const memberCtx = await browser.newContext();
    const memberPage = await memberCtx.newPage();
    await memberPage.goto(inviteLink!);
    await memberPage.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(memberPage).toHaveURL(/\/login/);

    // After signing up independently (account created by Identity at invite time),
    // log in with the one-time password and verify the role on the owner's side.
    await ownerPage.reload();
    await openUserMenu(ownerPage, "Miembros");

    // The member row shows the expected role (Miembro = WORKSPACE_MEMBER).
    await expect(ownerPage.getByText(member.email)).toBeVisible();
    await expect(ownerPage.getByText("Miembro").last()).toBeVisible();
    // Status is now Activo after acceptance.
    await expect(ownerPage.getByText("Activo").last()).toBeVisible();

    await ownerCtx.close();
    await memberCtx.close();
  });
});
