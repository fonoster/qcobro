## 1. Webapp — dialog changes

- [x] 1.1 In `PortfolioDetail.tsx`, compute the "rest of record" object by omitting the
      4 basic-field keys (`outstandingBalance`, `daysPastDue`, `phone`, `email`) from
      `viewDetail`.
- [x] 1.2 Add an `Accordion` (single item, collapsed by default) below the existing
      `<dl>` in the `viewDetail` `Dialog`, titled with the new `portfolios.detail.viewMetadata`
      i18n key, containing `<pre>{JSON.stringify(rest, null, 2)}</pre>`.
- [x] 1.3 Add `portfolios.detail.viewMetadata` ("View metadata" / "Ver metadata") to the
      en and es locales in `mods/webapp/src/lib/i18n.tsx`.

## 2. Tests

- [x] 2.1 Added `e2e/portfolio-account-details.spec.ts` (webapp has no unit-test runner,
      so e2e is the project's coverage pattern for page-level flows like this one) —
      verifies "Ver metadata" is collapsed by default and reveals fields (e.g.
      `missedInstallments`) not in the basic summary when expanded. Passes.

## 3. Verification

- [x] 3.1 `npm run typecheck` and `npx eslint` clean in `mods/webapp` (root `lint`
      script covers the workspace).
- [x] 3.2 Manually verified in the running app via browser automation: opened a
      portfolio, clicked "Ver detalle" on an account, confirmed the basic fields are
      unchanged and "Ver metadata" reveals the rest of the record as JSON.
