## 1. Identity client (Fonoster)

- [x] 1.1 Add `exchangeOauth2Code(provider, code)` and `createUserWithOauth2Code(code)` to `@fonoster/identity-client` (+ `Oauth2Provider` type)

## 2. OAuth2 procedures (apiserver)

- [x] 2.1 Add `oauthProviderEnum`, `oauthSignInSchema`, `oauthSignUpSchema` to `@qcobro/common`
- [x] 2.2 Add `auth.oauthSignIn` and `auth.oauthSignUp` (public), delegating to Identity

## 3. Console OAuth flow (deferred — pending Google provider in Identity)

- [ ] 3.1 Authorize redirect from the "Continuar con Google" button (config-driven client id + redirect URI)
- [ ] 3.2 `/oauth/callback` page: read `code`, call `auth.oauthSignIn` / `auth.oauthSignUp`, set tokens, route
- [ ] 3.3 Decide the final provider/label once Identity offers Google

## 4. Verification

- [x] 4.1 `npm run build`, `typecheck`, `lint` pass (common, apiserver)
- [ ] 4.2 Live: code exchange returns tokens — pending a published `@fonoster/identity-client` with the OAuth methods and a configured provider OAuth app
