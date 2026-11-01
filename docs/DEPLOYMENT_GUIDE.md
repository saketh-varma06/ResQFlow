# ResQFlow — Deployment Guide

> **Status (1 Nov 2026): ResQFlow has NOT been deployed anywhere yet. No public
> URL exists.** Everything in this guide is the verified procedure for deploying
> it, based on the actual code, configuration and scripts in this repository.
> Local development is fully working and verified (see `README.md`,
> `docs/PROJECT_AUDIT.md`, `docs/TEST_REPORT.md`); production deployment has not
> been performed.

> **Emergency disclaimer:** ResQFlow is an academic demonstration project. It is
> not connected to any government or official emergency service. In a real
> emergency, call **112** (India) or your local emergency number first.

---

## 1. What is being deployed

| Component | Technology (verified from `package.json`) | Production artefact |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 3, socket.io-client, vite-plugin-pwa | Static files in `frontend/dist/` (PWA service worker included) |
| Backend | Node.js, Express 5, TypeScript, Prisma 6, Socket.IO | Compiled JavaScript in `backend/dist/`, started with `node dist/index.js` |
| Database | PostgreSQL 16 (Prisma schema: 10 models, 4 migrations in `backend/prisma/migrations/`) | Managed or containerised PostgreSQL 16 |
| API docs | OpenAPI 3.0.3 (`backend/openapi.yaml`, 39 paths) | Served by the backend at `/api/docs` (Swagger UI) and `/api/docs.json` |

Ports in the current configuration:

- Backend: **4000** (`PORT`, default 4000)
- Frontend: **5173** in local development (`vite`), **4173** for local
  `vite preview`. In production the frontend is static files — the host chooses
  the port/URL.
- PostgreSQL: **5432** by default locally (`POSTGRES_PORT`).

The application **runs on PostgreSQL**. A MongoDB Atlas layer is being prepared
separately under `database/mongodb/` but it is **not connected** and the running
application does not use MongoDB. Do not set production behaviour to depend on
MongoDB until a real connection test with real credentials has succeeded (see
`docs/REQUIRED_CREDENTIALS.md`).

No third-party API keys are required: the external integrations (Open-Meteo
weather + geocoding, USGS earthquakes, GDACS feed, OpenStreetMap tiles) are all
keyless and are called from the backend with caching and provenance (see
`docs/API_INTEGRATION_REPORT.md`).

---

## 2. Production environment configuration

Configuration comes from two templates in the repo:

- Root `.env.example` — used by Docker Compose and as the combined reference.
- `backend/.env.example` — the backend's own template (same variables).
- `frontend/.env.example` — only `VITE_API_URL` (and the reserved, currently
  unused `VITE_SOCKET_URL`).

`.env` files are git-ignored (`.env` / `.env.*` except `.env.example`). **Never
commit a real `.env` file, and never put a production secret in git.**

The backend validates its environment at startup with Zod
(`backend/src/config/env.ts`). If a required variable is missing or invalid,
the process fails to start rather than running misconfigured.

### 2.1 Every variable, what it does, and production guidance

| Variable | Where it is used | What it does | Production guidance |
|---|---|---|---|
| `NODE_ENV` | Backend (validated: `development` \| `test` \| `production`), Docker Compose backend service | Selects production behaviour. Most importantly, session and CSRF cookies are set with `secure: true` only when `NODE_ENV=production` (`backend/src/utils/session.ts`), and the safe admin seeder refuses the demo password in production. | Set to `production` on every production backend. Never leave it as `development` in production — cookies would not get the `Secure` flag. |
| `PORT` | Backend | TCP port the Express + Socket.IO server listens on. Default `4000`. | `4000` unless the host assigns its own port (many PaaS hosts inject `PORT` themselves — in that case let the host set it and do not override it). The frontend's `VITE_API_URL` and the host's health check must point at the resulting public backend URL, not at this number directly. |
| `API_URL` | Listed in both `.env.example` files as the backend's own URL (e.g. `http://localhost:4000` locally) | Reference value for the backend base URL in the template. It is **not** one of the variables validated in `backend/src/config/env.ts`. | Set it to the public backend URL (e.g. `https://<your-backend-host>`) for consistency with the template, but do not rely on it to change runtime behaviour — the variables that actually drive behaviour are `PORT`, `CORS_ORIGIN`, `DATABASE_URL` and `VITE_API_URL`. |
| `CORS_ORIGIN` | Backend — Express CORS (`credentials: true`) **and** the Socket.IO handshake | **Comma-separated allowlist** of browser origins (scheme required) allowed to call the API with credentials. The socket connects cross-origin, so this must include the frontend origin. Fixed to an allowlist in the Phase 6 audit; verified live including foreign-origin rejection. | Set to the **real frontend origin(s) only**, comma-separated with no spaces needed, e.g. `https://<your-frontend-host>`. Include every origin the SPA is served from (custom domain and the host's default domain if both are used). Do **not** use `*` — credentialed CORS cannot use a wildcard, and an open allowlist defeats the session design. No trailing slash. |
| `POSTGRES_USER` | Docker Compose `postgres` service; used to build the Compose backend `DATABASE_URL` | PostgreSQL role name. Local/Compose default: `resqflow`. | For Compose: keep `resqflow` or choose your own, and keep it consistent with `DATABASE_URL`. For managed PostgreSQL (split hosting) this variable is not used by the app — the provider gives you the credentials inside its connection string. |
| `POSTGRES_PASSWORD` | Docker Compose `postgres` service | Password for `POSTGRES_USER`. Local default in the template is a **local-development-only** placeholder. | Generate a long random password. Never reuse the template value in production. Store it only in the host's environment settings / local `.env`. |
| `POSTGRES_DB` | Docker Compose `postgres` service | Database name created on first boot of a fresh volume. Local default: `resqflow`. Init scripts in `database/init/` run only on that first boot. | `resqflow` is fine. Note the init scripts do **not** replace Prisma migrations — always run migrations (§3.3 / §4.3). |
| `POSTGRES_PORT` | Docker Compose `postgres` service port mapping | Host port mapped to the container's 5432. Local default: `5432`. | Only relevant to Compose/self-hosting. On a public host, do not expose PostgreSQL to the internet; keep it on the private network / provider VPC. |
| `DATABASE_URL` | Backend / Prisma (`datasource db` in `backend/prisma/schema.prisma`, read as `env("DATABASE_URL")`) | PostgreSQL connection string the application actually uses, in the form `postgresql://<user>:<password>@<host>:<port>/<db>?schema=public`. Required by the Zod env validation. | Use the managed provider's connection string in split hosting, or the Compose-internal one in Docker hosting (Compose builds it as `postgresql://…@postgres:5432/…`). If the password contains special characters, URL-encode them. This is a secret — hosting environment settings only, never git, never chat. |
| `TEST_DATABASE_URL` | Local test runs only (Vitest backend suite runs against a separate test database) | Connection string for the disposable test database (local default database name `resqflow_test`). | **Not needed in production.** Do not point it at the production database. Set it only on machines that run the test suite. |
| `JWT_SECRET` | Backend — signs the session JWT carried in the httpOnly `resqflow_session` cookie (and Bearer tokens for API clients) | Anyone with this value can forge sessions for any user, including admins. Required by env validation. The template value `change_me_to_a_long_random_local_secret` is a placeholder only. | Generate a **new, long, random** secret for production (for example 48+ random characters / 32+ random bytes from a password generator or `openssl rand -hex 32` run locally). Never reuse the local/dev secret. Store it only in the host's environment settings. Rotating it logs out every user (all existing tokens stop verifying) — that is also the emergency response if it ever leaks. |
| `JWT_EXPIRES_IN` | Backend | Session token lifetime passed to `jsonwebtoken`. Default `7d`. | `7d` is the shipped default and is reasonable for this project. Shorten it (e.g. `1d`) if you prefer shorter-lived sessions; note logout and password change already invalidate sessions server-side via `tokenVersion`, regardless of expiry. |
| `BCRYPT_SALT_ROUNDS` | Backend | bcrypt cost factor for password hashing. Validated integer 4–15, default `12`. | Keep `12` (the default used by the seeders). Do not lower it in production. |
| `VITE_API_URL` | Frontend — read at **build time** in `frontend/src/lib/api.ts` (REST base) and `frontend/src/lib/socket.ts` (Socket.IO target) | The public backend base URL baked into the built frontend bundle. In local development the Vite dev/preview servers instead proxy `/api` and `/socket.io` to `http://localhost:4000`, so the local template value is `http://localhost:4000`. | Set it to the **public backend URL** (e.g. `https://<your-backend-host>`) in the frontend host's environment, **before building**. It is not a secret, but it is build-time only: changing it requires a **rebuild and redeploy** of the frontend — editing it afterwards has no effect on an already-built bundle. |
| `VITE_SOCKET_URL` | Listed in the root/backend/frontend `.env.example` files as reserved | **Not read by the code.** The audit (`docs/PROJECT_AUDIT.md` §6) records this as harmless doc drift: the socket target is derived from `VITE_API_URL`. | Do not set it expecting an effect. Set `VITE_API_URL` instead. |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | One-off safe admin seeding only: `npm run db:seed-admin` (`backend/prisma/seed-admin.ts`) | Creates/updates the first real administrator. Password must be supplied via the environment, be at least 12 characters, is never printed, and the well-known demo password is refused when `NODE_ENV=production`. Idempotent; re-running also increments the admin's `tokenVersion`. | Use once, against the production database, with a unique strong password held in your password manager. These are **not** long-running application settings — do not leave `ADMIN_PASSWORD` configured on the running service after seeding. |

### 2.2 Auth and session facts that affect deployment

- Web sessions use an **httpOnly `resqflow_session` cookie** (JWT, `SameSite=Lax`,
  `Secure` in production) plus a readable `resqflow_csrf` cookie; mutating
  cookie-authenticated requests must echo the CSRF value in the `x-csrf-token`
  header (double-submit). API clients may use `Authorization: Bearer <JWT>`
  instead and are CSRF-exempt by design.
- Logout and password change increment the user's `tokenVersion`, which
  invalidates all of that user's existing sessions **and sockets**.
- Public self-registration never creates an active RESPONDER or ADMIN — those
  accounts are created `PENDING` until an admin activates them.
- Because the session cookie is `SameSite=Lax` and CORS is credentialed, the
  frontend and backend should be served over **HTTPS** in production, and
  `CORS_ORIGIN` must exactly match the frontend origin(s) the browser sees.

### 2.3 Demo seed accounts — local use only

`npm run db:seed` creates demo data and the demo accounts listed in the README
(`admin@resqflow.local`, `citizen@resqflow.local`, `responder@resqflow.local`,
`fire@resqflow.local` with their published demo passwords).

- **Never run `npm run db:seed` against a production database.**
- **Never use the demo accounts or demo passwords in production.**
- Create the production admin with `npm run db:seed-admin` instead (§2.1).

---

## 3. Path A — Docker Compose full stack

### 3.1 What exists in the repo

- `docker-compose.yml` with three services:
  - `postgres` — `postgres:16-alpine`, named volume `resqflow_postgres_data`,
    init scripts from `database/init/`, `pg_isready` healthcheck. **Not**
    profile-gated: it starts with a plain `docker compose up`.
  - `backend` — built from `docker/backend.Dockerfile`, profile `full`,
    `NODE_ENV=production`, `PORT=4000`, waits for the postgres healthcheck.
  - `frontend` — built from `docker/frontend.Dockerfile`, profile `full`,
    served by nginx (`docker/nginx.conf`, SPA fallback to `index.html`),
    published as host port **5173 → container 80**.
- `docker/backend.Dockerfile` — `node:24-alpine`; installs the npm workspaces,
  copies `backend/`, runs `prisma generate` and the backend build. Start command:
  `npm run start -w backend` (i.e. `node dist/index.js`).
- `docker/frontend.Dockerfile` — two-stage: `node:24-alpine` builds
  `frontend/dist`, then `nginx:alpine` serves it.

> **Honest status:** these files were **written and YAML-verified, but not
> executed in the build sandbox** — Docker was not installed there
> (`docs/PROJECT_AUDIT.md` §3, README "Known limitations"). Treat the first real
> `docker compose` run as a test run: expect to fix small issues, and verify with
> the health checks in §5 before calling it deployed.

**Known gaps to fix on that first run (visible from the files as shipped):**

1. The Compose `backend` service sets `CORS_ORIGIN: http://localhost:5173`
   hard-coded in `docker-compose.yml`. Change it to your real frontend origin
   before exposing the stack.
2. The Compose backend does **not** run Prisma migrations automatically, and
   the frontend image build does not receive a `VITE_API_URL` build argument —
   the built SPA therefore has no public backend URL baked in. The Compose
   frontend is suitable for local/single-machine evaluation as shipped; for a
   public deployment prefer Path B, or adapt the Compose/Dockerfile setup so
   migrations run on release and `VITE_API_URL` is passed at image build time.
3. The Compose backend's `JWT_SECRET` falls back to the template placeholder
   (`${JWT_SECRET:-change_me_to_a_long_random_local_secret}`) if you do not set
   it. Always set a real one (§2.1).

### 3.2 Commands — database only (the documented local route)

```bash
docker compose up -d postgres        # PostgreSQL 16 on :5432
npm run db:generate                  # Prisma client (repo root script)
npm run db:migrate                   # apply migrations (dev: prisma migrate dev)
```

### 3.3 Commands — full stack

```bash
# 1. Create .env from the template and set REAL production values
#    (POSTGRES_PASSWORD, JWT_SECRET at minimum — see §2.1)
cp .env.example .env

# 2. Build and start all three services
docker compose --profile full up -d --build

# 3. Apply database migrations against the running database
#    (production form of the migration command — applies committed
#     migrations without generating new ones)
cd backend && npx prisma migrate deploy

# 4. Create the first real admin (NOT the demo seed)
ADMIN_EMAIL=<your-admin-email> ADMIN_NAME="<your name>" \
  ADMIN_PASSWORD='<a unique password, 12+ characters>' npm run db:seed-admin

# 5. Verify (see §5)
curl https://<your-backend-host>/api/health
```

Useful follow-ups: `docker compose --profile full ps`,
`docker compose --profile full logs -f backend`,
`docker compose --profile full down` (add `-v` only if you intentionally want
to delete the database volume).

---

## 4. Path B — Split hosting (recommended for a public deployment)

Shape: **backend on a Node host** (e.g. Render), **frontend as static files**
(e.g. Vercel), **managed PostgreSQL 16**. This matches how the app is built:
the frontend is a static SPA plus PWA assets, the backend is a single Node
process serving REST + Socket.IO, and Prisma only needs a `DATABASE_URL`.
Step-by-step account creation for these services is in
`docs/REQUIRED_CREDENTIALS.md`.

### 4.1 Managed PostgreSQL

1. Create a PostgreSQL **16** database with your provider.
2. Copy its connection string — that becomes the backend's `DATABASE_URL`
   (add `?schema=public` if the provider's string does not already include a
   schema parameter, matching the format in `.env.example`).
3. Keep the database reachable only from the backend host (provider firewall /
   private networking where offered). Do not expose port 5432 publicly.

### 4.2 Backend (Node host)

Build and start commands (from `backend/package.json`):

| Setting | Value |
|---|---|
| Root / working directory | Repository root (npm workspaces) — the host must install workspace dependencies |
| Install | `npm install` |
| Build | `npm run build -w backend` (runs `tsc -p tsconfig.json`, output `backend/dist/`) — also run `npm run prisma:generate -w backend` so the Prisma client is generated for the production platform |
| Release / pre-deploy | `npx prisma migrate deploy` (run from `backend/` — see §4.3) |
| Start | `npm run start -w backend` (runs `node dist/index.js`) |
| Health check path | `/api/health` |
| Environment | `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (real frontend origin), `JWT_EXPIRES_IN=7d`, `BCRYPT_SALT_ROUNDS=12`; let the host set `PORT` if it injects one |

Notes:

- A single backend instance is the assumed deployment: Socket.IO is
  authenticated and room-scoped in-process, and the external-data caches are
  in-memory. The repo contains no multi-instance socket adapter (e.g. Redis),
  so do not scale the backend horizontally without adding one.
- The backend also serves the API documentation at `/api/docs` — that is part
  of the shipped app (39 OpenAPI paths).

### 4.3 Database migrations on release

- Development uses `prisma migrate dev` (`npm run db:migrate`).
- **Production releases use `npx prisma migrate deploy`** (from `backend/`):
  it applies the committed migrations in `backend/prisma/migrations/`
  (currently 4) in order and creates none. Run it on every release, after the
  new code is in place and before/with the new backend start, with the
  production `DATABASE_URL` in the environment.
- Never run `prisma migrate dev`, `prisma db push`, or `npm run db:seed`
  against production.
- After migrations, create the first admin once with `npm run db:seed-admin`
  (§2.1) if this is a fresh database.

### 4.4 Frontend (static host)

| Setting | Value |
|---|---|
| Build command | `npm run build -w frontend` (runs `tsc -b && vite build`) |
| Output directory | `frontend/dist` |
| Environment (build time) | `VITE_API_URL=https://<your-backend-host>` |
| SPA routing | The host must rewrite unknown paths to `index.html` (client-side routing; the Docker nginx config `docker/nginx.conf` shows the equivalent `try_files … /index.html` rule). The PWA service worker must be served from the root scope. |

Notes:

- `VITE_API_URL` is **baked in at build time** (§2.1). Deploy the backend first,
  note its final public URL, then build the frontend with that value. If the
  backend URL changes later, rebuild and redeploy the frontend.
- After the frontend gets its final URL, go back and set the backend's
  `CORS_ORIGIN` to that exact origin and restart/redeploy the backend (§2.1).
  This ordering — backend URL → frontend build → CORS — is the step most likely
  to be missed.
- The local Vite proxy (`/api` → `localhost:4000`) exists only in the dev and
  preview servers; it plays no part in a production static deployment, which is
  why `VITE_API_URL` matters there.

---

## 5. Health checks

### 5.1 Backend health endpoint

```
GET /api/health        (public — no auth required)
```

Implemented in `backend/src/routes/health.ts`. It runs a real
`SELECT 1` against the database via Prisma on every call and returns HTTP 200
with:

```json
{
  "status": "ok",
  "service": "resqflow-backend",
  "phase": 2,
  "database": "up",
  "timestamp": "<ISO-8601 timestamp>",
  "uptimeSeconds": 123,
  "environment": "production"
}
```

Read it as follows:

- `status: "ok"` + `database: "up"` — service is up **and** the database
  connection works. This is the healthy state.
- `database: "down"` — the HTTP service responded but the `SELECT 1` failed:
  the process is alive, the database is not reachable (wrong `DATABASE_URL`,
  database down, or network/firewall between backend and database). The
  endpoint still returns HTTP 200 by design, so **a health check must inspect
  the `database` field, not just the status code.**
- No response at all — the backend process itself is down or not yet started.

Also available: `GET /` on the backend returns
`{ service, phase, docs: "/api/docs", health: "/api/health" }`, and the API
docs are at `GET /api/docs` — a quick way to confirm you are talking to the
ResQFlow backend and not something else.

The Docker Compose `postgres` service has its own `pg_isready` healthcheck;
the backend service in Compose waits for it (`condition: service_healthy`).

### 5.2 Host health-check configuration

- Backend host: health check path **`/api/health`**, and treat the deployment
  as healthy only when the body shows `"database": "up"` (if the host only
  checks the status code, still verify the body manually after each deploy).
- Frontend host: a `200` on `/` (the SPA `index.html`) is sufficient; then run
  the end-to-end checks in §7 / `docs/REQUIRED_CREDENTIALS.md` §10.

---

## 6. Logging notes

Be accurate about what exists today:

- **Application logging is minimal.** The backend logs one startup line to
  stdout (`ResQFlow backend listening on … — health: /api/health · docs:
  /api/docs`, `backend/src/index.ts`) and unhandled errors to stderr via the
  error middleware (`console.error("Unhandled error:", err)`,
  `backend/src/middleware/error.ts`). There is **no structured logging library**
  (no winston/pino/morgan) and no request log in the code.
- In production, rely on the **host's log capture** of stdout/stderr (both
  hosting paths above provide this) for crash and startup diagnosis.
- **The audit log is the in-app record**: security-relevant actions are written
  to the database and are readable by admins via `GET /api/audit-logs` and the
  admin Audit Logs page (filters include result, action, actor). It is an
  application audit trail, not a substitute for host logs.
- Frontend errors are not shipped to any external monitoring service — no
  monitoring/error-tracking integration exists in the repo. If you add one
  later, treat it as a new integration and document it; do not assume it exists.
- Operational signals available today: `/api/health` (§5), host stdout/stderr,
  and the admin Analytics page (computed live from the database).

---

## 7. Deployment checklist

Work top to bottom; do not skip the CORS and migration steps.

**Before deploying**

- [ ] All production values decided and generated: strong `JWT_SECRET`, strong
      database password, production admin email/name/password (12+ characters)
      — all held in your password manager, none in git or chat.
- [ ] Managed PostgreSQL 16 created (Path B) **or** a Docker host ready
      (Path A); database not publicly exposed.
- [ ] Code is in the Git repository you will deploy from (see
      `docs/REQUIRED_CREDENTIALS.md` §5) and the commit you intend to deploy is
      identified.

**Backend**

- [ ] Backend environment set: `NODE_ENV=production`, `DATABASE_URL`,
      `JWT_SECRET`, `JWT_EXPIRES_IN=7d`, `BCRYPT_SALT_ROUNDS=12` (§2.1).
      `CORS_ORIGIN` set to the frontend origin — or set immediately after the
      frontend URL is known, before declaring the deployment done.
- [ ] Build succeeds: `npm run build -w backend` (with `prisma generate`).
- [ ] Migrations applied: `npx prisma migrate deploy` from `backend/`.
- [ ] Service starts: `npm run start -w backend`; host health check on
      `/api/health` passes **and** the body shows `"database": "up"` and
      `"environment": "production"`.
- [ ] First admin created with `npm run db:seed-admin` (never `db:seed`);
      demo accounts are absent from the production database.

**Frontend**

- [ ] `VITE_API_URL` set to the final public backend URL in the frontend
      host's environment.
- [ ] Build succeeds: `npm run build -w frontend`; `frontend/dist` published.
- [ ] SPA fallback to `index.html` configured on the static host.
- [ ] Backend `CORS_ORIGIN` updated to the final frontend origin and the
      backend restarted/redeployed.

**End-to-end verification**

- [ ] Frontend loads over HTTPS; registration of a new **citizen** succeeds and
      login works (session cookie is set; browser shows no CORS errors).
- [ ] A test SOS/incident can be created and is visible after reload (proves
      database persistence, not just UI state).
- [ ] Realtime connects (the app shows its live/realtime state; a second
      account's action produces a live update/notification) — proves
      Socket.IO + `CORS_ORIGIN` are correct.
- [ ] `GET /api/docs` on the backend loads the OpenAPI documentation.
- [ ] Shelters/alerts public reads load on the landing page.
- [ ] Admin login works and the admin dashboard shows live analytics.
- [ ] The full checklist in `docs/REQUIRED_CREDENTIALS.md` §10 has been run.

---

## 8. Rollback notes

There is no automated rollback tooling in this repo; rollback is a manual,
deliberate procedure. Plan it before you need it.

**Application code**

- Redeploy the **previous known-good commit / build artefact**. On the split
  hosting path this means: point the backend service back to the previous
  commit and redeploy, and do the same for the frontend (remember the frontend
  bundle contains `VITE_API_URL` — a rolled-back frontend must have been built
  against the backend URL that will actually serve it).
- On the Docker path, rebuild from the previous commit
  (`docker compose --profile full up -d --build`) — the database volume is
  untouched by a code rollback.

**Database**

- **Migrations are the hard part.** `prisma migrate deploy` only moves forward;
  Prisma does not auto-generate down-migrations. Before any release that adds a
  migration, take a **database backup/snapshot** (managed providers offer
  point-in-time restore / snapshots — take one, or `pg_dump` on the Docker
  path).
- If a release fails *before* its migration ran, rolling back code alone is
  enough. If the migration already ran, prefer **rolling forward** with a
  fix-up migration; restore the pre-release backup only as a last resort, and
  accept that data written since the backup will be lost.
- Never "fix" a production database by editing the `_prisma_migrations` table
  or running `prisma migrate dev` against it.

**Configuration**

- Configuration rollback = restore the previous environment values and
  restart/redeploy the backend. The values most likely to need this are
  `CORS_ORIGIN` (frontend origin changed) and `DATABASE_URL` (database moved).
- Rotating `JWT_SECRET` is a valid emergency action (e.g. suspected leak) but
  it **logs out every user immediately**, including admins — treat it as an
  incident action, not a routine rollback step.

**After any rollback**

- Re-run §5 health checks and the smoke checks in §7 (login, one test record,
  realtime) before calling the system recovered, and record what was rolled
  back, from which commit to which, in `docs/DEVELOPMENT_PROGRESS.md`.

---

## 9. Related documents

- `README.md` — local setup, demo accounts (local only), test commands.
- `docs/REQUIRED_CREDENTIALS.md` — the account/credential checklist for the
  deployment day (Atlas, GitHub, Render, Vercel), including what must never be
  shared with the assistant.
- `docs/PROJECT_AUDIT.md` — verified feature/integration inventory.
- `docs/API_INTEGRATION_REPORT.md` — external API behaviour (caching,
  provenance, failure states).
- `docs/ARCHITECTURE.md` — system layout.
