# AR Payment Portal

A learning project: a B2B customer portal where users see the open accounts-receivable items of the business partners assigned to them and pay those items, fully or partially, through a payment provider. Payments are then posted back to SAP reliably and idempotently.

Built with **SAP CAP (Node.js, strict TypeScript)** and **SAPUI5** (Fiori Elements and freestyle).

> This is a personal learning project, not production software. The SAP backends and the payment provider are mocks.

## What it will do

- Show open items (invoices, credit memos, residual items) per business partner, read through a `DataSource` layer that hides whether the backend is ECC or S/4HANA.
- Authorise users per business partner and per action (view, pay, dispute), on top of CAP roles.
- Create payments with idempotency keys, hand customers over to a payment provider checkout, and accept signed webhooks.
- Post payments to SAP through an outbox with retries, safe to run on several instances at once.
- Let customers dispute items and let admins resolve disputes.

## Status

| Area                                                                                                                      | Status               |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Project setup: CAP + strict TypeScript, ESLint, Prettier, GitHub Actions CI                                               | ✅ Done              |
| Pure helpers: money, clock, dates, ECC mapper, overdue, payment reference, request hash, retry backoff, webhook signature | ✅ Done, unit-tested |
| CDS data model, seed data, Open Items list report                                                                         | ⏳ Next              |
| DataSource abstraction (mock ECC, mock S/4, S/4 sandbox)                                                                  | Planned              |
| Per-business-partner authorisation                                                                                        | Planned              |
| Payments and mock payment provider                                                                                        | Planned              |
| Webhooks, outbox, reliability                                                                                             | Planned              |
| PostgreSQL, reconcile job, multi-instance                                                                                 | Planned              |
| Disputes                                                                                                                  | Planned              |

## Getting started

Requirements: Node.js 22 and the CAP CLI (`npm i -g @sap/cds-dk`).

```bash
npm ci
npm run watch        # CAP server on http://localhost:4004
npm test             # unit tests
```

## Scripts

| Script                 | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm run watch`        | Start CAP with live reload; TypeScript is loaded through `tsx` |
| `npm test`             | Run all tests with the Node.js test runner (`node:test`)       |
| `npm run typecheck`    | Type-check the project with `tsc --noEmit`                     |
| `npm run lint`         | ESLint with `typescript-eslint` strict type-checked rules      |
| `npm run format`       | Format all files with Prettier                                 |
| `npm run format:check` | Check formatting without changing files (used in CI)           |

CI runs `npm ci`, lint, format check, type check, tests and `npm audit --audit-level=high` on every push and pull request.

## Project structure

```text
srv/lib/
  money.ts                          amounts as integer cents
  clock.ts                          injectable clock for "now" and "today"
  dates.ts                          ISO date helpers, always in UTC
  datasource/mock-ecc/
    mock-ecc-mapper.ts              ECC formats: ALPHA conversion, DATS dates, debit/credit sign
  open-items/overdue.ts             days overdue for an open item
  payment/references.ts             payment reference (PAY-XXXXXXXX), UUID v4 check
  payment/request-hash.ts           SHA-256 fingerprint of a payment request
  jobs/backoff.ts                   retry schedule for posting to SAP
  psp/signature.ts                  HMAC signing and verification of webhooks
test/unit/                          one test file per module
.github/workflows/ci.yml            CI pipeline
```

## Design decisions

- **Money is integer cents.** Amounts are converted from and to decimal strings and never added as floating-point numbers, so `0.1 + 0.2` problems cannot occur. Inputs with more than two decimals are rejected, never rounded.
- **Dates are calculated in UTC.** Date arithmetic uses `Date.UTC` and ISO strings, so results do not depend on the machine's time zone or daylight saving time.
- **"Now" is injected.** All time-dependent logic reads from an injectable clock, or receives the time as a parameter, so tests are deterministic.
- **SAP identifiers are strings.** Customer, document and material numbers are never converted to numbers, because JavaScript numbers lose precision beyond 15–16 digits.
- **Pure functions first.** Business rules live in small pure functions under `srv/lib/` that can be tested without starting CAP; service handlers stay thin.
- **Failures are explicit.** Invalid input throws; expected business outcomes (such as retries being exhausted or a webhook being rejected) are returned as values.

## Dependencies and security

- `.npmrc` sets `save-exact=true`, `package-lock.json` is committed, and CI installs with `npm ci`.
- TypeScript is pinned to 6.0.x because `typescript-eslint` does not support 7.x yet. Re-check monthly with `npm view typescript-eslint peerDependencies`.
- Install scripts are only allowed after review; `esbuild` (a dependency of `tsx`) has been reviewed and approved.
- CI fails on `npm audit` findings of high severity.
- No secrets are committed; `.env` and `.cdsrc-private.json` are ignored.

## Conventions

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`.
- Test names reference the business rule they cover, for example `BR-12`.
- One branch per week (`w1/foundation`, `w2/data-model`, …), merged into `main` through a pull request with green CI.
