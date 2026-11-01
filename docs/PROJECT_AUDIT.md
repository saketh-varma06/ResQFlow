# ResQFlow — Project Audit

Audit date: 1 Nov 2026 · Scope: the entire existing implementation in this repository
(frontend, backend, database, realtime, external APIs, environment, tests).
Method: source inspection + production builds + automated test suites + live HTTP/socket
verification against the running application. Nothing in this report is assumed;
integration status was verified from code and by calling the endpoints.

## 1. Technology stack (verified from package.json files)

| Layer | Technology |
|---|---|
| Monorepo | npm workspaces (`@resqflow/frontend`, `@resqflow/backend`) |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 3, shadcn/ui (Radix), React Router, Recharts, Leaflet/react-leaflet, socket.io-client, vite-plugin-pwa |
| Backend | Node 24, Express 5, TypeScript, Prisma 6, PostgreSQL 16, Socket.IO, Zod, JWT (jsonwebtoken) + bcryptjs, Helmet, CORS, express-rate-limit, cookie-parser |
| Tests | Vitest + supertest (backend, incl. socket.io-client realtime tests), Vitest (frontend unit) |
| Docs/API | OpenAPI 3.0.3 (`backend/openapi.yaml`, 39 paths) served at `/api/docs` |
| Infra (repo) | docker-compose.yml (PostgreSQL + optional full profile), Dockerfiles for both apps, nginx config for the frontend image |

## 2. Features already implemented (and verified)

- **Auth & RBAC:** registration (citizens activate immediately; RESPONDER/ADMIN
  registrations are PENDING until an admin activates them), login, logout, password
  change. Sessions: httpOnly `resqflow_session` cookie (JWT) + Bearer token for API
  clients; `tokenVersion` invalidation on logout/password change; CSRF double-submit
  for cookie-auth mutations; per-route role guards; auth rate limiting.
- **Citizen:** dashboard (live data + external panel), SOS with category/geolocation/
  confirmation, incident reporting (with offline outbox + draft persistence), shelters
  (live capacity, accessibility, map), alerts, area map, request tracking with status
  timelines, notifications (live), profile + password change.
- **Responder:** command centre (priority queue, availability switch, map, external
  panel), assigned incidents (accept/decline/complete), SOS inbox (acknowledge,
  self-assign, progress, resolve), incident details (workflow transitions, notes,
  timeline), history, operations map.
- **Admin:** dashboard (live analytics), incident management (assign/status/delete),
  alert management (CRUD; ACTIVE alerts notify area citizens), shelter management
  (CRUD with capacity validation), user management (approve/suspend/role/delete),
  responder management (create/edit/delete units), analytics (Recharts from real DB
  computations), audit logs (filters + pagination), operations map.
- **Workflow:** one validated lifecycle for incidents and SOS —
  SUBMITTED → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED (+ CANCELLED
  for SOS) — enforced server-side; skips are rejected with 400.
- **Priority scoring:** explainable rule-based 0–100 score with reasons (documented as
  a dispatcher aid, not validated triage).
- **Realtime:** authenticated Socket.IO only (anonymous rejected; tokenVersion
  checked). Role/user-scoped events for SOS, incidents, assignments, alerts, shelters,
  notifications; frontend toasts + live badge/lists.
- **Notifications:** database-backed for all major triggers (SOS lifecycle, assignment,
  status changes, notes, alerts), mark-read/read-all, unread count.
- **Analytics:** totals, by status/severity/type, 14-day trends, pending SOS + oldest
  wait, average acknowledgement/resolution from status history, shelter utilization,
  responder workload — all computed from the database at request time.
- **PWA:** installable manifest + icons, service worker (app-shell precache, OSM tile
  cache, network-first shelters/alerts), offline indicator, offline outbox with honest
  "not received by the server" states and automatic retry.
- **External data (backend-proxied, keyless):** Open-Meteo weather, USGS earthquakes,
  GDACS disaster feed — with per-source provenance, caching and stale/unavailable
  handling (details in `API_INTEGRATION_REPORT.md`).

## 3. Features partially implemented

- **Landing page** shows live shelters/alerts (public reads) — by design it does not
  show incidents/SOS publicly (privacy).
- **Maps** show incidents/SOS/shelters; USGS earthquake events were panel-only
  (map layer added in this audit round — see §7).
- **Place search** for coordinates used the browser geolocation + manual entry;
  Open-Meteo geocoding search added in this round (see §7).
- **Playwright E2E:** not configured in the repo (Vitest covers API/realtime/unit).
- **Docker:** compose/Dockerfiles are written and YAML-verified; Docker is not
  installed in this sandbox, so containers were not executed here.

## 4. Features missing (not implemented anywhere)

- No file/image upload feature (incident photos) — no upload endpoint exists.
- No SMS/email/push delivery — notifications are in-app (DB + socket) only.
- No connection to any real emergency service (by design; the UI says call 112).
- No multi-language UI; no password-reset-by-email flow (admin/seed reset only).
- No global search (a dead header search box was found and removed in the Phase 6 audit).

## 5. APIs currently used

### 5.1 First-party API (this project) — CONNECTED and tested
Base URL (local): `http://localhost:4000` · All routes under `/api`, JSON envelopes
`{ data }` / `{ data, meta }`, Zod-validated, role-guarded. 38 documented paths:
health; auth (register/login/me/logout/change-password); users (+/me); incidents
(+status/assign/notes/accept/decline/complete); sos (+status/assign); responders
(+me/availability, me/profile); shelters; alerts; notifications (+unread-count,
read-all, {id}/read); external/overview; analytics/overview; audit-logs.
Status: **connected** — exercised by 54 backend tests and live curl/socket runs;
authentication and database persistence verified end-to-end (data survives restarts).

### 5.2 Third-party APIs
| API | Endpoint (as coded) | Where | Auth | Status |
|---|---|---|---|---|
| Open-Meteo Forecast | `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=precipitation_sum&forecast_days=3&timezone=auto` | `backend/src/services/external.service.ts` → `GET /api/external/overview` → `ExternalDataPanel` (citizen dashboard, responder command centre) | none (keyless) | **Connected, live-verified** (real Delhi weather returned) |
| USGS Earthquakes | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson` filtered to regional bbox lat 5–40 / lon 65–100 | same service → overview → panel (+ map layer added this round) | none | **Connected, live-verified** (feed fetched; 0 regional events in the past day at audit time — reported as zero, not padded) |
| GDACS | `https://www.gdacs.org/xml/rss.xml` (RSS; the swagger API was evaluated — RSS is the public no-key route that works from here) | same service → overview → panel | none | **Connected, live-verified** (12 current items returned, 1 India-related) |
| OpenStreetMap tiles | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Leaflet maps (frontend) | none (tile usage policy applies) | **Connected** (standard tile layer + attribution) |
| Open-Meteo Geocoding | `https://geocoding-api.open-meteo.com/v1/search` | **added this round**: `GET /api/external/geocode` → operations map place search | none | Connected (see API report) |

No other third-party APIs exist in the code. No API keys are required by any
integration; no secrets appear in frontend code (verified by search).

## 6. Environment & configuration (verified)

- Backend env (Zod-validated, `backend/src/config/env.ts`): NODE_ENV, PORT (4000),
  CORS_ORIGIN (**comma-separated allowlist** — fixed in the Phase 6 audit; the socket
  connects cross-origin so this must include the frontend origin), DATABASE_URL,
  JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS.
- Frontend: `VITE_API_URL` (REST base used via the Vite proxy in dev; socket target).
  `.env.example` also lists `VITE_SOCKET_URL`, which the code does not read — the
  socket uses `VITE_API_URL`. Noted as doc drift, harmless.
- `.env` files are git-ignored; `.env.example` contains placeholders only.

## 7. Bugs found in this audit round and fixes applied

(The previous Phase 6 audit — CORS allowlist, audit-log actorEmail filter, hardcoded
notification badge, dead search box, landing preview data — is recorded in
`docs/PHASE6_REALTIME_ANALYTICS_PWA.md` §7.)

1. USGS earthquakes were not visible on the operations map → added a toggleable
   "Earthquakes (USGS)" layer fed by `/api/external/overview`, with provenance text.
2. No place search for finding locations by name → added backend geocoding proxy
   (`/api/external/geocode`, cached, timeout, honest unavailable state) and a place
   search on the operations map that centres the map and drops a marker.
3. Admins had no external-data view → `ExternalDataPanel` added to the admin dashboard.
4. Emergency disclaimer existed on SOS/About but not on the landing page → added an
   explicit disclaimer band (academic project, not an emergency service, call 112).
5. `scripts/pg-local.sh status` failed as root (pg_ctl refuses root) → runs via the
   `pguser` account like start/stop.

## 8. Recommended improvements (not done — recorded honestly)

- Add Playwright E2E for the browser flows (login, SOS happy path, route guards).
- Incident photo uploads would need an object store + malware scanning design.
- The external-data bbox is India-centric (lat 5–40, lon 65–100) and weather defaults
  to Delhi; make the region configurable per deployment.
- `VITE_SOCKET_URL` in `.env.example` should be removed or wired for clarity.
- Priority scoring is rule-based by design; any production use needs validation with
  real dispatch data.
