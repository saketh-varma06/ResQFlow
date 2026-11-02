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

## Critical database persistence tests — 1 Nov 2026 (PostgreSQL)

STEP D: database-level proof against the **current running PostgreSQL**
(user-space PostgreSQL 16.2, databases `resqflow` / `resqflow_test`, user
`resqflow`), executed live against the running backend on
`http://localhost:4000` with `curl` cookie jars (CSRF double-submit header on
cookie-auth mutations) and direct `psql` verification via
`scripts/pg-local.sh psql`. All results below are actual observed values from
this run. The test citizen created for this run:
`dbtest-1793556601@resqflow.local`, user id `cmvy5ajhj0062zsxtg3skkv8x`.

### Test 1 — Registration + password hashing

- **Done:** `POST /api/auth/register` with a fresh citizen
  (`dbtest-1793556601@resqflow.local`, role CITIZEN, area Guwahati).
- **Expected:** HTTP 201; a `User` row in PostgreSQL whose `passwordHash` is a
  bcrypt hash, not the plaintext password.
- **Actual:** HTTP **201**, user id `cmvy5ajhj0062zsxtg3skkv8x`. psql:
  `SELECT … FROM "User" WHERE email = …` returned 1 row — role `CITIZEN`,
  status `ACTIVE`, `length(passwordHash) = 60`, hash prefix `$2b$`,
  and `passwordHash = <plaintext>` evaluated to `false`.
- **Result: PASS**

### Test 2 — Login (correct and wrong password)

- **Done:** `POST /api/auth/login` with the correct password, then
  `GET /api/auth/me` with the session jar; separately, login with a wrong
  password.
- **Expected:** correct login 200 with a working session (`/me` 200); wrong
  password 401.
- **Actual:** correct login HTTP **200** (token issued, same user id
  `cmvy5ajhj0062zsxtg3skkv8x`); `GET /api/auth/me` HTTP **200** returning that
  user; wrong password HTTP **401** (`Invalid email or password`).
- **Result: PASS**

### Test 3 — SOS creation, API read-back, and DB row

- **Done:** as the test citizen, `POST /api/sos` with category `FLOOD`,
  `people: 4`, `injuriesReported: 1`, `trapped: true`, location
  "DB Test Street, Guwahati"; then `GET /api/sos/:id`; then psql checks on
  `SOSRequest` and `SOSStatusHistory`.
- **Expected:** 201 with an id; read-back fields match the submission with
  status `SUBMITTED` and a `SUBMITTED` status-history entry; matching row in
  PostgreSQL.
- **Actual:** HTTP **201**, SOS id `cmvy5auhr006czsxt2ol86yuh`,
  priorityScore 50 / priorityLevel `HIGH` (reasons include trapped +15).
  Read-back matched every submitted field, status `SUBMITTED`,
  `statusHistory` = 1 entry (`fromStatus` null → `toStatus` `SUBMITTED`,
  note "SOS submitted"). psql: `SOSRequest` row present with the same id,
  status `SUBMITTED`, category `FLOOD`, people 4, trapped `t`,
  injuriesReported 1; `SOSStatusHistory` has the corresponding `SUBMITTED`
  row.
- **Result: PASS**

### Test 4 — Incident update + status history

- **Done:** as the citizen, `POST /api/incidents` (FLOOD, HIGH,
  peopleAffected 12); as admin (`admin@resqflow.local`),
  `PATCH /api/incidents/:id/status` → `ACKNOWLEDGED`; re-GET; psql check on
  `Incident` and `IncidentStatusHistory` (model name confirmed in
  `backend/prisma/schema.prisma`).
- **Expected:** incident created `SUBMITTED`; the valid transition persists;
  a history row records `SUBMITTED → ACKNOWLEDGED`.
- **Actual:** create HTTP **201**, incident id
  `cmvy5ay1t006lzsxtyxr340gc`, status `SUBMITTED`. Admin login 200; PATCH
  HTTP **200**; re-GET status `ACKNOWLEDGED`. psql: `Incident.status =
  ACKNOWLEDGED`; `IncidentStatusHistory` has **2 rows** for the incident —
  (null → `SUBMITTED`, changed by the citizen) and (`SUBMITTED` →
  `ACKNOWLEDGED`, changed by the admin user id
  `cmvy544u00000zss989v1xsic`).
- **Result: PASS**

### Test 5 — Shelter create + occupied update

- **Done:** as admin, `POST /api/shelters` (capacity 200, occupied 10);
  `PATCH /api/shelters/:id` with `occupied: 47`; re-GET; psql check on
  `Shelter`.
- **Expected:** 201 on create; the occupied change persists on read-back and
  in the database; `available` recomputed server-side.
- **Actual:** create HTTP **201**, shelter id
  `cmvy5b5oq006zzsxthzsu733d`, `available` 190. PATCH HTTP **200**;
  re-GET: occupied **47**, capacity 200, available **153**, status `OPEN`.
  psql: `Shelter` row with the same id shows capacity 200, occupied 47,
  status `OPEN`.
- **Result: PASS**

### Test 6 — Restart persistence (core proof)

- **Done:** backend PID found via `ss -ltnp | grep :4000` = **2513**; that
  numeric PID was killed (port 4000 confirmed free); backend restarted with
  `nohup node dist/index.js` from `backend/` (log
  `/tmp/resqflow-backend.log`); health checked; then a **fresh** citizen
  login jar was created and the test-3 SOS, test-5 shelter, and test-4
  incident were re-fetched.
- **Expected:** `GET /api/health` → status ok, database up; all previously
  created records still present with the same ids and statuses after the
  restart — i.e. data lives in PostgreSQL, not in process memory.
- **Actual:** health after restart: `status ok`, `database up`. New backend
  PID **3571**. Fresh login HTTP **200**. Re-GET SOS
  `cmvy5auhr006czsxt2ol86yuh` → status `SUBMITTED`, category `FLOOD`,
  people 4, trapped true, history [`SUBMITTED`]. Re-GET shelter
  `cmvy5b5oq006zzsxthzsu733d` → occupied 47, capacity 200, available 153,
  status `OPEN`. Re-GET incident `cmvy5ay1t006lzsxtyxr340gc` → status
  `ACKNOWLEDGED`.
- **Result: PASS**

### Test 7 — Authorization matrix

- **Done:** three negative checks with the jars from the earlier tests
  (responder account `responder@resqflow.local`, login 200).
- **Expected / Actual:**
  - Citizen jar → `GET /api/analytics/overview`: expected 403, actual
    **403**.
  - No jar → `GET /api/auth/me`: expected 401, actual **401** (also
    `GET /api/incidents` without a jar: **401**).
  - Responder jar → `GET /api/users`: expected 403, actual **403**
    (`Requires role: ADMIN`).
- **Result: PASS**

### Summary

| # | Test | Result |
|---|---|---|
| 1 | Registration + bcrypt hashing | PASS |
| 2 | Login 200 / wrong password 401 | PASS |
| 3 | SOS create + read-back + DB row + history | PASS |
| 4 | Incident status update + history rows | PASS |
| 5 | Shelter create + occupied update | PASS |
| 6 | Backend restart persistence | PASS |
| 7 | Authorization matrix (403 / 401 / 403) | PASS |

**7/7 PASS.** No failures in this run. Environment left running: backend on
:4000 (PID 3571, health `database up`), frontend dev on :5173 (HTTP 200).
Test artefacts left in the database for inspection: citizen
`dbtest-1793556601@resqflow.local` (`cmvy5ajhj0062zsxtg3skkv8x`), SOS
`cmvy5auhr006czsxt2ol86yuh`, incident `cmvy5ay1t006lzsxtyxr340gc`, shelter
`cmvy5b5oq006zzsxthzsu733d`. Login budget note: the run stayed economical
with logins (register + citizen/admin/responder logins, one wrong-password
attempt, one fresh post-restart login) and the rate limiter was never
tripped.

## MongoDB Atlas verification — 2 Nov 2026 (live cluster)

Ran `npm run verify` in `database/mongodb/` against the user's real Atlas cluster
(Cluster0, AWS Mumbai, free tier) using the prepared Mongoose layer. **All 9 checks
PASSED** (real round-trips; test documents were deleted by the script afterwards):

1. Connect + admin ping — MongoDB reachable.
2. Indexes built on all 10 collections, incl. the shelter `2dsphere` index (5 shelter indexes).
3. Test user stored with a **bcrypt** password hash (60 chars), never plaintext.
4. bcrypt compare verifies the test password.
5. SOS document with GeoJSON location created and read back (id recorded in the run log).
6. Two status-history rows for that SOS preserved.
7. `$near` (5 km, Delhi point) found the test shelter.
8. `$near` from a Chennai point correctly excluded it.
9. A wrong-password connection was **rejected** by Atlas (authentication enforced).

Scope note: this verifies the prepared Mongoose layer against Atlas. The running
application still uses PostgreSQL; switching the app runtime to Atlas is the
separate cutover described in `docs/DATABASE_DESIGN.md`.

## MongoDB Atlas cutover verification — 2 Nov 2026

The backend was rewired from Prisma/PostgreSQL to Mongoose/MongoDB Atlas with
the HTTP API contract frozen. All gates were executed against the real Atlas
cluster (M0, Mumbai) — database `resqflow` for live checks, `resqflow_test`
for the test suite.

| Gate | Result |
|---|---|
| Root build (backend tsc + frontend Vite) | **0 errors** |
| Backend test suite on Atlas (57 tests, 6 files, zero assertion changes) | **57/57 PASS** (~285 s on the free tier) |
| Frontend test | **1/1 PASS** |
| Lint | **0 errors** (10 pre-existing warnings) |
| Response-shape parity vs the PostgreSQL build (32 normalised endpoint captures diffed) | **Parity** after 2 serialiser fixes (see below) |
| Live E2E on the Mongo-backed server (register→login, wrong-password 401, SOS create→skip-400→ack→assign→citizen history `[SUBMITTED, ACKNOWLEDGED, ASSIGNED]`, incident create→assign→accept→IN_PROGRESS→note→RESOLVED→citizen tracking, shelter capacity 400 case, analytics keys, 401/403 matrix, health `database: "up"`) | **24/24 PASS** |
| Socket smoke (anonymous rejected, cookie session connects, responder receives `incident:created`/`incident:updated`, unrelated citizen does NOT receive `incident:updated`) | **5/5 PASS** |
| Restart persistence (backend killed + restarted; E2E-created SOS `ASSIGNED` with 3 history rows and incident `RESOLVED` with 5 history rows re-fetched intact) | **PASS** |
| `npm run verify` in `database/mongodb/` | **9/9 PASS** (after alignment, see below) |
| Prisma in the working tree | **Zero imports** (grep-verified); `backend/prisma/` and `src/database/` deleted; lockfile has no `@prisma` entries |

**Shape-parity fixes (found by the baseline diff, fixed in
`backend/src/services/serialize.ts`):** (1) StatusHistory entries in detail
responses leaked Mongo's `_id`/`__v` — the entity-mapping branch now applies
the same key normalisation as every other object. (2) An unassigned SOS lost
its `responderProfile: null` key — Mongoose does not register population for
a null foreign key, so the serialiser now emits `null` for an included
just-one relation whose foreign key is null, matching Prisma.

**Standalone-layer alignment (gate: verify):** the prepared layer in
`database/mongodb/` originally stored GeoJSON points in a `location` field
with 2dsphere indexes, which collides with the API contract's string
`location` + scalar coordinates on the shared collections (its index build
failed on real app data). The layer was aligned to the contract shape
(`location` string, scalar lat/lng, no 2dsphere); `verify.ts` keeps **9
checks with the same semantics** — the SOS round-trip now asserts the string
location + coordinates, and the proximity checks use a ±0.045° (≈5 km)
latitude/longitude bounding box instead of `$near`. All 9 pass; the Delhi
proximity check also found the 4 real seeded shelters.

**Cosmetic difference noted:** list ordering may differ when `createdAt`
values tie (MongoDB dates have millisecond precision; seeded rows can share
a millisecond). No API ordering guarantee is affected for real data.

**Frontend changes for the cutover: none.**

---

## Advancement programme — Stages A–G (2 Nov 2026)

Feature research first (Sahana Eden, SAMBRO/CAP, Ushahidi, HOT Tasking Manager,
CrisisCleanup, InaSAFE, SACHET/NDMA, ReliefWeb), then seven stages built onto the
existing codebase, each gated on build + new tests + live E2E + commit.
Full narrative: `docs/ADVANCEMENT_REPORT.md`.

**Full backend suite (final gate, per-file runs against `resqflow_test` on Atlas): 96/96**

| File | Tests | | File | Tests |
|------|-------|-|------|-------|
| api.test.ts | 21 | | verification.test.ts (A) | 5 |
| authz.test.ts | 9 | | capalerts.test.ts (B) | 7 |
| workflow.test.ts | 7 | | dispatch.test.ts (C) | 4 |
| shelters.test.ts | 5 | | relief.test.ts (D) | 6 |
| external.test.ts | 8 | | fieldkit.test.ts (E) | 6 |
| realtime.test.ts | 7 | | sitrep.test.ts (F) | 6 |
| | | | missingpersons.test.ts (G) | 5 |

Frontend: 1/1. Root build: 0 TypeScript errors. Lint: 0 errors (11 warnings).
Per-stage live E2E on the Atlas dev database: A 10/10, B 8/8, C 6/6 (real OSRM
road times), D 6/6, E 4/4, F 5/5 (EONET + GloFAS live), G 4/4.
OpenAPI: 78 paths (was 39 before the programme).

Notes: the first final-gate full-suite attempt was killed by a sandbox VM
restart 55 minutes in before printing results; the suite was re-run per-file
with results logged incrementally (all green above). Stage E's live run caught
a real defect the fresh test DB could not: a sparse compound unique index on
`clientRequestId` fails to build over existing documents — replaced with a
unique partial index and re-verified live. No Grok API key was required.
