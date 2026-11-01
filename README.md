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
| Backend | Node.js, Express 5, TypeScript, Prisma 6, Socket.IO, Zod, JWT + bcrypt, Helmet, rate limiting |
| Database | PostgreSQL 16 (Prisma schema: 10 models, 4 migrations) |
| Tests | Vitest + supertest (backend 57 tests incl. realtime socket tests), Vitest (frontend) |
| API docs | OpenAPI 3.0.3 at `GET /api/docs` (39 paths) |

## Architecture

```
frontend (React SPA, :5173 dev / :4173 preview)
  │  REST /api (Vite proxy → backend, cookie session + CSRF)
  │  Socket.IO (direct to backend, session cookie, role/user rooms)
backend (Express + Socket.IO, :4000)
  ├── routes → controllers → services → Prisma → PostgreSQL 16
  ├── auth: httpOnly cookie JWT + tokenVersion invalidation, RBAC guards
  ├── realtime: authenticated sockets, scoped emits, DB notifications
  └── external.service: Open-Meteo / USGS / GDACS (cache + provenance)
```

More detail: `docs/ARCHITECTURE.md`, `docs/PROJECT_AUDIT.md`,
`docs/API_INTEGRATION_REPORT.md`.

## Database setup

**Option A — Docker (recommended on your own machine):**
```bash
docker compose up -d postgres        # PostgreSQL 16 on :5432
```

**Option B — any local PostgreSQL 16:** create a user `resqflow` and databases
`resqflow` and `resqflow_test`, then point `DATABASE_URL` / `TEST_DATABASE_URL`
at them (see `.env.example`).

Then:
```bash
npm run db:generate                  # Prisma client
npm run db:migrate                   # apply migrations (dev)
npm run db:seed                      # demo data + demo accounts (local only)
```

## Environment variables

Copy `.env.example` → `.env` (root) and `backend/.env.example` → `backend/.env`.
Placeholders only — generate your own `JWT_SECRET`. Key variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `TEST_DATABASE_URL` | PostgreSQL connection strings |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | session signing |
| `PORT` | backend port (4000) |
| `CORS_ORIGIN` | **comma-separated** browser origin allowlist, e.g. `http://localhost:5173,http://localhost:4173` — the socket connects cross-origin, so every frontend origin must be listed |
| `VITE_API_URL` | frontend → backend base URL (socket target; REST uses the dev proxy) |

No third-party API keys are required by any integration.

## Local startup

```bash
npm install                          # all workspaces
# start PostgreSQL (Option A or B above), then migrate + seed (above)
npm run dev                          # backend :4000 + frontend :5173 (dev servers)
```
or run the production build:
```bash
npm run build                        # backend dist/ + frontend dist/ (PWA included)
cd backend && node dist/index.js     # API + sockets on :4000
cd frontend && npx vite preview      # app on :4173
```

- **Frontend:** http://localhost:5173 (dev) or http://localhost:4173 (preview)
- **Backend:** http://localhost:4000 · **Health:** http://localhost:4000/api/health
- **API docs:** http://localhost:4000/api/docs

### Demo accounts (local seed only — never use in production)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@resqflow.local` | `Admin@12345` |
| Citizen | `citizen@resqflow.local` | `Citizen@12345` |
| Responder (River Rescue 12) | `responder@resqflow.local` | `Responder@12345` |
| Responder (Fire & Rescue 3) | `fire@resqflow.local` | `Responder@12345` |

A non-demo admin can be created safely with
`ADMIN_EMAIL=… ADMIN_NAME=… ADMIN_PASSWORD=… npm run db:seed-admin`.

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
  with nginx) plus PostgreSQL. Set real secrets in `.env` first; set
  `CORS_ORIGIN` to your public frontend origin(s).
- **Split hosting (e.g. PaaS + managed Postgres):** deploy `backend/` with
  `DATABASE_URL` pointing at managed PostgreSQL, run `npx prisma migrate deploy`
  on release, serve `frontend/dist` from any static host, and set `VITE_API_URL`
  to the backend URL at build time. **No accounts or credentials are bundled** —
  any hosting/database account must be created by you; nothing in this repo
  deploys itself.
- This project has **not** been deployed to any public URL.

## Security considerations

- Passwords hashed with bcrypt; sessions are httpOnly cookies; logout and password
  change invalidate all existing sessions and sockets (`tokenVersion`).
- CSRF double-submit on cookie-authenticated mutations; Bearer clients exempt by
  design (no ambient cookie authority).
- Public self-registration can never grant RESPONDER/ADMIN directly — such accounts
  are created PENDING until an admin activates them.
- All inputs are Zod-validated; Prisma parameterises queries; responses strip
  password hashes; rate limits on auth and API; Helmet headers; CORS allowlist.
- SOS/incident locations are visible only to the owner, responders and admins
  (citizens see only their own SOS pins); audit logs record security-relevant actions.

## Known limitations

- Notifications are in-app only (no SMS/email/push). No photo/file uploads.
- No connection to real emergency services (see the disclaimer above).
- External earthquake coverage is the India-centric region (lat 5–40, lon 65–100);
  weather defaults to Delhi unless coordinates are supplied.
- Priority scoring is an explainable rule-based aid, **not** validated triage.
- In the original build sandbox, Docker was unavailable and PostgreSQL ran as a
  user-space instance; on a normal machine use Docker Compose as documented.
  Sandbox-specific helpers live in `scripts/` (`pg-restore.sh`, `pg-local.sh`) and
  are not needed elsewhere.
