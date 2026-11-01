# ResQFlow — Test Report

Date: 1 Nov 2026 · Environment: this sandbox (Node v24.22.1, npm 10.9.4,
PostgreSQL 16.2 user-space instance, databases `resqflow` / `resqflow_test`).
All results below were produced by actually running the commands/checks listed.

## Automated tests

| Suite | Command | Result |
|---|---|---|
| Backend (Vitest, 6 files) | `npm test -w backend` (root: `npm test`) | **57/57 passed** |
| — `api.test.ts` (21) | auth, users, incidents lifecycle, SOS, responders, shelters, alerts, notifications, analytics, audit | passed |
| — `authz.test.ts` (9) | cookie sessions, CSRF, logout/password invalidation, pending accounts, role 403s, assignment scoping | passed |
| — `workflow.test.ts` (7) | priority scoring units + full SOS workflow E2E, transition validation, self-cancel | passed |
| — `external.test.ts` (8) | USGS/GDACS parsers, overview provenance, stale-on-outage behaviour, geocode endpoint (auth/mapping/validation) | passed |
| — `shelters.test.ts` (5) | capacity validation (create/update/shrink), availability computation | passed |
| — `realtime.test.ts` (7) | anonymous socket rejected, logout-invalidated token rejected, SOS scoping, acknowledgement notification (socket + DB + mark-read), assignment events, alert broadcast, shelter broadcast, analytics shape | passed |
| Frontend (Vitest, 1 file) | `npm test -w frontend` | **1/1 passed** (`cn` utility) |
| Builds | `npm run build` (backend tsc + frontend tsc/Vite incl. PWA) | **passed**, 0 TypeScript errors |
| Lint | `npm run lint` (oxlint, frontend) | **0 errors**, 10 warnings (idiomatic shadcn variant exports + hook-style notes) |
| Migrations | `prisma migrate status` | **up to date** (4 migrations) |
| Playwright E2E | not previously configured in this repo | see note below |

## Live workflow verification (running servers, via the frontend proxy :5173 → backend :4000)

| # | Workflow | Result |
|---|---|---|
| 1 | Citizen registration (201) + login (200) | passed |
| 2 | Responder login (seeded unit account) | passed |
| 3 | Admin login | passed |
| 4 | Citizen submits SOS (201, priority scored) | passed |
| 5 | Responder views SOS inbox + acknowledges (200) | passed |
| 6 | Admin assigns incident to a responder unit (201) | passed |
| 7 | Assigned responder accepts (200), sets IN_PROGRESS (200), adds note (201), resolves (200) | passed |
| 8 | Citizen tracks final status: incident RESOLVED with full status history; SOS ACKNOWLEDGED with history [SUBMITTED, ACKNOWLEDGED] | passed |
| 9 | Shelter search (`?search=Central`) + details: available 560, accessibility present | passed |
| 10 | Weather (Open-Meteo via `/api/external/overview`): status ok, "Clear sky", 23.1 °C, Delhi | passed |
| 11 | USGS earthquakes: status ok, feed fetched live, **0 regional events** in past day (real, not padded) | passed |
| 12 | GDACS: status ok, 12 items, 1 India-related | passed |
| 13 | Geocoding: "Guwahati" → 26.1844, 91.7458; map data endpoints (incidents/SOS/shelters) return coordinates | passed |
| 14 | Unauthorized access: anonymous → analytics 401; citizen → admin analytics 403; responder → admin users 403 | passed |
| + | Realtime over the browser's cookie path: anonymous socket rejected; cookie sockets connect per role; SOS reaches responder only; acknowledgement notifies the citizen | passed |
| + | CORS: socket handshake from the :4173 origin returns that origin; foreign origin not reflected | passed |
| + | Admin CRUD live: responders create/patch/delete, alerts create/publish/delete (all 200/201) | passed |
| + | PWA assets served: `/manifest.webmanifest`, `/sw.js`, icons (200) | passed |

Two apparent failures during the live pass were **verification-script errors, not app
bugs**: (a) the script first assigned an incident to the wrong unit (the list's first
profile is a different unit) — the resulting 404/403 were correct authorization
behaviour, and the corrected pass succeeded; (b) the script read a `history` field
where the API (and the frontend) use `statusHistory`.

## Playwright note

Playwright was not configured in this repository before this round. This round added
`playwright.config.ts`, four browser smoke specs (`e2e/smoke.spec.ts`: landing +
disclaimer, anonymous route-guard redirect, citizen login → dashboard, admin login →
analytics) and an `npm run test:e2e` script, and the `@playwright/test` package
installed successfully. **The Chromium browser binary could not be downloaded in
this sandbox** (the Playwright CDN transfer stalled through the egress proxy across
two attempts, and `playwright install --with-deps` additionally depends on apt,
which cannot fetch here), so **no Playwright test result is claimed**. On a normal
machine: `npx playwright install chromium` then `npm run test:e2e` with the app
running. Browser-driven coverage in this round stands at: API-level E2E (supertest),
socket-level E2E (socket.io-client), and the scripted live workflow verification above.

## Known limits of this test round

- Visual/browser rendering could not be screenshot-verified in this sandbox (the
  hosted browser tool rejects loopback addresses); pages are verified by build +
  HTTP 200 + API behaviour.
- A true offline-device PWA run (airplane mode) was not performed; the offline outbox
  logic is covered by code review and build output, and its server endpoints are the
  same ones exercised above.
- Docker containers were not executed (Docker is not installed in this sandbox);
  compose/Dockerfiles are YAML-verified only.
