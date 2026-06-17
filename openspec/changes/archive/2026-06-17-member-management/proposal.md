## Why

The apiserver already exposes the full member surface (invite-with-name, resend
invitation, remove member), but the console only surfaces _invite_ plus a bare remove
icon. Owners/admins can't resend a pending invitation, can't clearly cancel one, and
destructive actions happen with no confirmation. This change completes the
member-management UX in the console — no new backend work, just surfacing what exists.

## What Changes

- **Per-row actions menu (`⋯`) on Miembros.** Pending members get **Reenviar invitación**
  and **Cancelar invitación**; active members get **Quitar miembro**.
- **Confirmation before destructive member actions.** Removing a member or cancelling an
  invitation prompts a reusable simple confirm dialog.
- **Invitations require a name.** The invite form collects a required `Nombre` (the
  apiserver schema and Identity already require it); ensure the console form and the
  design both reflect it.

## Capabilities

### Modified Capabilities

- `web-console`: The Members page gains a per-row resend/cancel/remove actions menu with
  confirmation, and the invite form collects the required member name.

## Impact

- **webapp:** wire `workspaces.resendInvitation` into the Members row menu; add the confirm
  dialog to remove/cancel; the invite name field is already present.
- **design (Pencil):** Members row menu, the simple confirm popup, and the invite modal's
  name field.
- **Out of scope:** delete-workspace, profile, 2FA, OAuth, contact verification (separate
  changes).
