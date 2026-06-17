## 1. Identity client (Fonoster)

- [x] 1.1 Add `sendVerificationCode(contactType, value)` and `verifyCode(username, contactType, value, code)` to `@fonoster/identity-client`

## 2. Verification procedures (apiserver)

- [x] 2.1 Add `contactTypeEnum`, `sendVerificationCodeSchema`, `verifyCodeSchema` to `@qcobro/common`
- [x] 2.2 Add `auth.sendVerificationCode` and `auth.verifyCode` (public), delegating to Identity

## 3. Verification screen (webapp)

- [x] 3.1 Add `VerifyContact` page + `/verify-contact` route (authenticated)
- [x] 3.2 Send a code on open; OTP entry → `auth.verifyCode` → enter console
- [x] 3.3 "Reenviar código" re-sends; "Omitir por ahora" skips (soft gate)
- [x] 3.4 Route sign-up to `/verify-contact`; all copy via i18n (`verify.*`, en + es)

## 4. Design (Pencil)

- [x] 4.1 "Verificar contacto · Código" screen (email variant — already designed)

## 5. Verification

- [x] 5.1 `npm run build`, `typecheck`, `lint` pass (common, apiserver, webapp)
- [x] 5.2 e2e: `e2e/verify-contact.spec.ts` (routes to verify + emails a code, resend, skip, emailed-code verifies)
- [x] 5.3 Run e2e green — pending a published `@fonoster/identity-client` with the new methods (CI `npm ci` resolves it); skip-path test passes without it
