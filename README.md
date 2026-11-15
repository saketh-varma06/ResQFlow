# ResQFlow — Disaster Management & Emergency Response Platform

ResQFlow connects citizens, emergency responders and administrators in one system:
SOS requests with explainable priority scoring, verified incident reports, live
shelter capacity, targeted disaster alerts, role-scoped realtime updates, and
operational analytics — backed by a real database, real authentication and a
validated status workflow.

> **Emergency disclaimer:** ResQFlow is an academic demonstration project. It is
> **not connected to any government or official emergency service**, and submitting
> an SOS or report here does not alert official responders. In a real emergency,
> call **112** (India) or your local emergency number first.

## Features

- **Citizens** — register/login, one-flow SOS (category, people, injuries, trapped,
  browser geolocation with manual fallback), incident reporting, live shelters with
  capacity + accessibility, alerts, area map, request tracking with status timelines,
  realtime notifications, offline SOS/report outbox with honest "not received yet"
  states.
- **Responders** — dark command centre with a priority-sorted queue, availability
  switch, assigned incidents (accept/decline/complete), SOS inbox (acknowledge,
  self-assign, progress, resolve), incident details with notes and workflow-validated
  transitions, history, operations map.
- **Administrators** — live dashboard and analytics (14-day trends, pending SOS,
  acknowledgement/resolution times, shelter utilization, responder workload), and
  full management of incidents, alerts, shelters, users and responder units, plus a
  complete audit log.
- **Workflow** — one server-validated lifecycle for incidents and SOS:
  `SUBMITTED → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`
  (+ `CANCELLED` for SOS). Skipped transitions are rejected.
- **Realtime** — authenticated Socket.IO (anonymous connections are rejected;
  logout invalidates sockets too), events scoped by role and ownership, live toasts
  and unread badges.
- **External data** — Open-Meteo weather + geocoding, USGS earthquakes (panel and
  map layer), GDACS disaster feed — backend-proxied, cached, with source and
  fetched-time provenance and honest stale/unavailable states. Never presented as
  official warnings.
- **PWA** — installable, app-shell caching, offline indicator and outbox.

## Technology stack

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 3, shadcn/ui (Radix), React Router, Recharts, Leaflet, socket.io-client, vite-plugin-pwa |
| Backend | Node.js, Express 5, TypeScript, Mongoose 8, Socket.IO, Zod, JWT + bcryptjs, Helmet, rate limiting |
| Database | MongoDB Atlas (MongoDB 8.0) via Mongoose — 10 collections (see `docs/DATABASE_DESIGN.md`) |
| Tests | Vitest + supertest (backend 57 tests incl. realtime socket tests), Vitest (frontend) |
| API docs | OpenAPI 3.0.3 at `GET /api/docs` (39 paths) |

## Architecture

```
frontend (React SPA, :5173 dev / :4173 preview)
  │  REST /api (Vite proxy → backend, cookie session + CSRF)
  │  Socket.IO (direct to backend, session cookie, role/user rooms)
backend (Express + Socket.IO, :4000)
  ├── routes → controllers → services → Mongoose → MongoDB Atlas
  ├── auth: httpOnly cookie JWT + tokenVersion invalidation, RBAC guards
  ├── realtime: authenticated sockets, scoped emits, DB notifications
  └── external.service: Open-Meteo / USGS / GDACS (cache + provenance)
```

More detail: `docs/ARCHITECTURE.md`, `docs/PROJECT_AUDIT.md`,
`docs/API_INTEGRATION_REPORT.md`.

## Database setup

The application runs on **MongoDB Atlas** (a free M0 cluster is enough).
Create a cluster + database user in Atlas, allow your IP (or `0.0.0.0/0` for
hosted deployments) under Network Access, and put the connection string in
`backend/.env` as `MONGODB_URI` (see `backend/.env.example` — use the
`mongodb+srv://` form on normal networks). Then:

```bash
npm run db:setup -w backend          # connect + sync indexes (10 collections)
npm run db:seed -w backend           # demo data + demo accounts (local only)
```

Tests use a separate `resqflow_test` database on the same cluster, derived
automatically from `MONGODB_URI` (override with `MONGODB_URI_TEST`).
No local database server or Docker is needed for the database.
(The pre-cutover PostgreSQL/Prisma stack remains in git history and in
`docs/DATABASE_DESIGN.md` as the historical fallback.)

## Environment variables

Copy `.env.example` → `.env` (root) and `backend/.env.example` → `backend/.env`.
Placeholders only — generate your own `JWT_SECRET`. Key variables:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (database `resqflow`); `MONGODB_URI_TEST` optionally overrides the test database |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | session signing |
| `PORT` | backend port (4000) |
| `CORS_ORIGIN` | **comma-separated** browser origin allowlist, e.g. `http://localhost:5173,http://localhost:4173` — the socket connects cross-origin, so every frontend origin must be listed |
| `VITE_API_URL` | frontend → backend base URL (socket target; REST uses the dev proxy) |

No third-party API keys are required by any integration.


## Test commands

```bash
npm test                             # backend 57 + frontend 1 (Vitest)
npm run build                        # TypeScript + production builds
npm run lint                         # oxlint (frontend)
```

See `docs/TEST_REPORT.md` for the verified results, including the 14 live workflow
checks (registration → SOS → acknowledgement → assignment → resolution → tracking,
shelter search, external APIs, unauthorized-access rejection).

## API documentation

OpenAPI 3.0.3 spec: `backend/openapi.yaml`, served at `/api/docs` (Swagger UI) and
`/api/docs.json`. All endpoints return `{ data }` / `{ data, meta }` envelopes and
are Zod-validated and role-guarded. External integrations are documented in
`docs/API_INTEGRATION_REPORT.md`.

## Deployment instructions

- **Containers:** `docker compose --profile full up -d` builds the backend and
  frontend images (`docker/backend.Dockerfile`, `docker/frontend.Dockerfile`
  with nginx). The database is MongoDB Atlas (cloud) — set `MONGODB_URI` and a
  real `JWT_SECRET` in `.env` first, and `CORS_ORIGIN` to your public frontend
  origin(s).
- **Split hosting (e.g. PaaS + Atlas):** deploy `backend/` with `MONGODB_URI`
  pointing at your Atlas cluster (use the `mongodb+srv://` form), run
  `npm run db:setup -w backend` once to sync indexes, serve `frontend/dist`
  from any static host, and set `VITE_API_URL` to the backend URL at build
  time. **No accounts or credentials are bundled** — any hosting/database
  account must be created by you; nothing in this repo deploys itself.
- This project has **not** been deployed to any public URL.

## Security considerations

- Passwords hashed with bcrypt; sessions are httpOnly cookies; logout and password
  change invalidate all existing sessions and sockets (`tokenVersion`).
- CSRF double-submit on cookie-authenticated mutations; Bearer clients exempt by
  design (no ambient cookie authority).
- Public self-registration can never grant RESPONDER/ADMIN directly — such accounts
  are created PENDING until an admin activates them.
- All inputs are Zod-validated; Mongoose casts and parameterises queries; responses strip
  password hashes; rate limits on auth and API; Helmet headers; CORS allowlist.
- SOS/incident locations are visible only to the owner, responders and admins
  (citizens see only their own SOS pins); audit logs record security-relevant actions.

## Known limitations

- Notifications are in-app only (no SMS/email/push). No photo/file uploads.
- No connection to real emergency services (see the disclaimer above).
- External earthquake coverage is the India-centric region (lat 5–40, lon 65–100);
  weather defaults to Delhi unless coordinates are supplied.
- Priority scoring is an explainable rule-based aid, **not** validated triage.
- The database was migrated from PostgreSQL/Prisma to MongoDB Atlas/Mongoose
  on 2 Nov 2026 with the HTTP API unchanged (see `docs/DATABASE_DESIGN.md` and
  `docs/TEST_REPORT.md`). Sandbox-specific PostgreSQL helpers in `scripts/`
  (`pg-restore.sh`, `pg-local.sh`) are historical artefacts of the old stack
  and are not used by the application.
