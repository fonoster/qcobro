## Why

The login and sign-up screens offer "Continuar con Google", but nothing was wired
behind it. Identity exposes OAuth2 code exchange (`ExchangeOauth2Code`) and OAuth2
account creation (`CreateUserWithOauth2Code`), so the apiserver can support social
sign-in. This change lands the backend half now and records the console-facing
provider expectation.

## What Changes

- **OAuth2 procedures.** Add `auth.oauthSignIn` (exchange an authorization code for
  tokens) and `auth.oauthSignUp` (create an account from an authorization code,
  returning tokens), delegating to Identity.
- **Frontend deferred (by decision).** The "Continuar con Google" button stays as-is
  for now; the console OAuth flow (`/oauth/callback`, authorize redirect) is **not**
  wired in this change.

## Provider note (expected soon)

> Identity's OAuth2 provider enum currently supports **GitHub only**, while the console
> presents **Google**. A **Google** provider is an **expected upcoming feature** in
> Identity. Until it lands, the OAuth backend can exercise GitHub, but the console's
> Google button remains inert; the frontend flow will be wired once Identity offers
> Google (or the console adopts the available provider).

## Capabilities

### Modified Capabilities

- `authentication`: Adds OAuth2 sign-in and sign-up (authorization-code exchange and
  OAuth2 account creation), delegating to Identity. Provider support tracks Identity
  (GitHub today; Google expected).

## Impact

- **Depends on:** `auth-and-workspaces` (authentication capability, token handling).
- **Code:** `@qcobro/common` `oauthProviderEnum` / `oauthSignInSchema` /
  `oauthSignUpSchema`; apiserver `auth.oauthSignIn` / `auth.oauthSignUp`;
  `@fonoster/identity-client` `exchangeOauth2Code` / `createUserWithOauth2Code`
  (+ `Oauth2Provider` type).
- **Design:** existing "Continuar con Google" button (unchanged).
- **Deferred (separate change, pending Google provider):** console OAuth flow —
  authorize redirect, `/oauth/callback`, set-tokens-and-route, and the final button
  provider/label.
- **Out of scope:** 2FA (Identity exposes no enrollment RPCs), provider account linking.
