## Why

`auth-and-workspaces` specifies that the apiserver verifies a contact (email) code,
but the procedures and the console screen were never built. New accounts had no way to
confirm their email. This change implements `auth.sendVerificationCode` /
`auth.verifyCode` and adds the post-sign-up verification screen already designed in
`pencil.pen` ("Verificar contacto · Código").

## What Changes

- **Contact verification procedures.** Add `auth.sendVerificationCode` (send a one-time
  code to an email or phone) and `auth.verifyCode` (confirm the code), delegating to
  Identity's `SendVerificationCode` / `VerifyCode`.
- **Verification screen after sign-up.** New accounts land on `/verify-contact`: a code
  is sent to their email, and a 6-digit code confirms it. "Reenviar código" re-sends.
- **Soft gate.** Verification can be skipped ("Omitir por ahora") so it never blocks a
  new user from entering the console; phone verification is a later variant.

## Capabilities

### Modified Capabilities

- `authentication`: Realizes the contact-verification half of the existing "Password
  reset and contact verification" requirement — send-code and verify-code procedures.
- `web-console`: Adds the post-sign-up contact-verification screen (OTP entry, resend,
  skip).

## Impact

- **Depends on:** `auth-and-workspaces` (introduces the `authentication` capability).
- **Code:** `@qcobro/common` `sendVerificationCodeSchema` / `verifyCodeSchema` +
  `contactTypeEnum`; apiserver `auth.sendVerificationCode` / `auth.verifyCode`;
  `@fonoster/identity-client` `sendVerificationCode` / `verifyCode`; webapp
  `VerifyContact` page + `/verify-contact` route; sign-up routes here; i18n `verify.*`.
- **Design:** `pencil.pen` — "Verificar contacto · Código" (email variant).
- **Out of scope:** phone verification variant, hard verification gate (blocking the
  console until verified), 2FA.
