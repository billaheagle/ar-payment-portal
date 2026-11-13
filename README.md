# AR Payment Portal

A learning project: a B2B customer portal where users see the open accounts-receivable items of the business partners assigned to them and pay those items, fully or partially, through a payment provider. Payments are then posted back to SAP reliably and idempotently.

Built with **SAP CAP (Node.js, strict TypeScript)** and **SAPUI5** (Fiori Elements and freestyle, TypeScript).

> This is a personal learning project, not production software. The SAP backends and the payment provider are mocks.

## What it will do

- Show open items (invoices, credit memos, residual items) per business partner, read through a `DataSource` layer that hides whether the backend is ECC or S/4HANA.
- Authorise users per business partner and per action (view, pay, dispute), on top of CAP roles.
- Create payments with idempotency keys, hand customers over to a payment provider checkout, and accept signed webhooks.
- Post payments to SAP through an outbox with retries, safe to run on several instances at once.
- Let customers dispute items and let admins resolve disputes.

## Status

| Area                                                                                                                      | Status                                |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Project setup: CAP + strict TypeScript, ESLint, Prettier, GitHub Actions CI                                               | ✅ Done                               |
| Pure helpers: money, clock, dates, ECC mapper, overdue, payment reference, request hash, retry backoff, webhook signature | ✅ Done, unit-tested                  |
| CDS data model, mock SAP tables, seed data                                                                                | ✅ Done                               |
| Open Items list report (Fiori Elements, TypeScript)                                                                       | ✅ Done                               |
| DataSource abstraction (mock ECC, mock S/4) with identical results                                                        | ✅ Done, unit- and integration-tested |
| OData query translation (filters, sorting, paging, single item by key)                                                    | ✅ Done, unit- and integration-tested |
| Per-business-partner authorisation                                                                                        | ⏳ Next                               |
| Payments and mock payment provider                                                                                        | Planned                               |
| Webhooks, outbox, reliability                                                                                             | Planned                               |
| PostgreSQL, reconcile job, multi-instance                                                                                 | Planned                               |
| Disputes                                                                                                                  | Planned                               |
| S/4 sandbox data source (SAP API Business Hub)                                                                            | Planned                               |

## Getting started

Requirements: Node.js 24 and the CAP CLI (`npm i -g @sap/cds-dk`).

```bash
npm ci
npm run typer        # generate TypeScript types from the CDS model
npm run watch        # CAP server on http://localhost:4004 (backend only)
npm run watch:ui     # CAP server including the Open Items app
```

Open the Open Items app from the index page at `http://localhost:4004` and sign in with a mocked user:

| User                | Password | Role                                |
| ------------------- | -------- | ----------------------------------- |
| `alice@acme.test`   | `test`   | CustomerUser                        |
| `carol@acme.test`   | `test`   | CustomerUser                        |
| `bob@globex.test`   | `test`   | CustomerUser                        |
| `dave@nobody.test`  | `test`   | CustomerUser (no business partners) |
| `admin@portal.test` | `test`   | PortalAdmin                         |

The data source is chosen in `package.json` under `cds.arportal.dataSource`: `mock-s4` (default) or `mock-ecc`. Both return the same open items.

## Scripts

| Script                 | What it does                                                                   |
| ---------------------- | ------------------------------------------------------------------------------ |
| `npm run watch`        | Start CAP for backend work (UI5 plugin disabled, fast restarts)                |
| `npm run watch:ui`     | Start CAP with the UI5 app served through `cds-plugin-ui5` (needs a 4 GB heap) |
| `npm run typer`        | Generate TypeScript types from the CDS model into `@cds-models/`               |
| `npm test`             | Run unit and integration tests with the Node.js test runner (`node:test`)      |
| `npm run typecheck`    | Type-check the backend with `tsc --noEmit`                                     |
| `npm run lint`         | ESLint with `typescript-eslint` strict type-checked rules                      |
| `npm run format`       | Format all files with Prettier                                                 |
| `npm run format:check` | Check formatting without changing files (used in CI)                           |
| `npm run check`        | Lint, format check, type check and tests in one go; run before every commit    |

Tests run with `CDS_PLUGIN_UI5_ACTIVE=false`: integration tests only need the OData service, and starting the UI5 tooling in every test server exhausts memory.

CI runs `npm ci`, type generation, lint, format check, type check, tests and a production dependency audit on every push and pull request.

## Project structure

```text
app/openitems/                      Fiori Elements list report (UI5, TypeScript)
_i18n/                              texts for CDS annotations (labels, entity names)
db/
  types.cds                         enums and the ItemKey aspect
  schema.cds                        portal entities and virtual entities
  mock.cds                          mock SAP tables (ECC and S/4 shapes)
  data/                             seed data (CSV)
srv/
  customer-service.cds / .ts        CustomerService definition and handlers
  lib/
    money.ts                        amounts as integer cents
    clock.ts                        injectable clock for "now" and "today"
    dates.ts                        ISO date helpers, always in UTC
    datasource/                     ArDataSource interface, factory, shared helpers
      mock-s4/                      mock S/4 data source and mapper
      mock-ecc/                     mock ECC data source and mapper (ALPHA, DATS, debit/credit)
    open-items/                     read handler, OData query translator, overdue calculation
    payment/                        payment reference, UUID v4 check, request hash
    jobs/backoff.ts                 retry schedule for posting to SAP
    psp/signature.ts                HMAC signing and verification of webhooks
test/
  unit/                             pure-function tests, one file per module
  integration/                      tests against a running CAP server (cds.test)
.github/workflows/ci.yml            CI pipeline
```

## Design decisions

- **Money is integer cents.** Amounts are converted from and to decimal strings and never added as floating-point numbers, so `0.1 + 0.2` problems cannot occur. Inputs with more than two decimals are rejected, never rounded.
- **Dates are calculated in UTC.** Date arithmetic uses `Date.UTC` and ISO strings, so results do not depend on the machine's time zone or daylight saving time.
- **"Now" is injected.** All time-dependent logic reads from an injectable clock, or receives the time as a parameter, so tests are deterministic.
- **SAP identifiers are strings.** Customer, document and material numbers are never converted to numbers, because JavaScript numbers lose precision beyond 15–16 digits.
- **Open items belong to SAP, not to the portal.** `OpenItems` and `BusinessPartners` are virtual entities (`@cds.persistence.skip`); a read handler fills them from the backend instead of a portal table.
- **One data source interface.** Handlers talk to `ArDataSource`; a factory picks mock S/4 or mock ECC from `cds.env.arportal.dataSource`. Mappers translate backend rows into one domain shape, and the handler maps that shape to OData. Both data sources return identical results for the same query (parity tests).
- **Mock ECC and S/4 tables keep their original shapes.** ECC stores dates as `YYYYMMDD`, unsigned amounts with a debit/credit indicator and zero-padded customer numbers; S/4 uses ISO dates and signed amounts.
- **Push-down with a documented exception.** Mock S/4 filters, sorts and pages in SQL, with the item key as a tie-breaker so paging is stable. Mock ECC filters overdue items, sorts and pages in memory, because ECC has no net due date column and stores unsigned amounts.
- **OData query options through an allowlist.** A pure translator turns CAP's CQN into a data source query; anything it does not support returns `400 UNSUPPORTED_QUERY`. A business partner filter can narrow the authorised scope but never widen it. Page size is limited by `@cds.query.limit` (default 30, maximum 200).
- **Pure functions first.** Business rules live in small pure functions under `srv/lib/` that can be tested without starting CAP; service handlers stay thin.
- **Failures are explicit.** Invalid input throws; expected business outcomes (such as retries being exhausted or a webhook being rejected) are returned as values.

## Dependencies and security

- `.npmrc` sets `save-exact=true`, `package-lock.json` is committed, and CI installs with `npm ci`.
- TypeScript is pinned to 6.0.x for the whole repository because `typescript-eslint` does not support 7.x yet. Re-check monthly with `npm view typescript-eslint peerDependencies`.
- `@sap/cds` is pinned to the 10.x line that matches `@sap/cds-dk` 10 and the `@cap-js/*` packages.
- Install scripts are only allowed after review (`allowScripts` in `package.json`): `esbuild` (used by `tsx`) and `ui5-tooling-transpile` (compiles the app's TypeScript).
- CI blocks high-severity advisories in production dependencies only (`npm audit --omit=dev`). Current advisories are all in development tooling (UI5 tooling via `cds-plugin-ui5`, ESLint via `minimatch`) and have no non-breaking fix yet. Re-check monthly with `npm audit`.
- `cds-plugin-ui5` serves the UI5 app through `cds watch`.
- `@cap-js/cds-test` provides `cds.test()` for integration tests; `axios` (dev only) supplies the response types that `@cap-js/cds-types` uses for it.
- No secrets are committed; `.env` and `.cdsrc-private.json` are ignored.

## Conventions

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`.
- Test names reference the business rule or specification section they cover, for example `BR-12` or `spec 15.2`.
- CDS elements use PascalCase to match SAP APIs; TypeScript variables use camelCase.
- Code comments are in English and explain why, not what.
- One branch per week (`w1/foundation`, `w2/data-model`, …), merged into `main` through a pull request with green CI.
