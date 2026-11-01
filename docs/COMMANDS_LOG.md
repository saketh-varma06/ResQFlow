# Phase 0 — Commands Executed & Results

Environment (verified 2026-11-01): Node v24.22.1 · npm 10.9.4 · Git 2.43.0 · Docker: NOT INSTALLED in this environment (blocker for running Compose here only).

| # | Command | Result |
|---|---------|--------|
| 1 | `node --version; npm --version; git --version; docker --version` | Node/npm/Git OK; `docker: command not found` |
| 2 | `npm create vite@latest frontend -- --template react-ts` | Frontend scaffolded (React 19, TS, Vite 8) |
| 3 | `npm install` (root, workspaces) | OK — 55 packages |
| 4 | `npm install -w @resqflow/frontend react-router-dom recharts leaflet react-leaflet lucide-react clsx tailwind-merge class-variance-authority @radix-ui/react-slot socket.io-client` | OK — 63 packages |
| 5 | `npm install -w @resqflow/frontend -D tailwindcss@^3.4.17 postcss autoprefixer @types/leaflet vitest` | OK — 94 packages |
| 6 | `npm install -w @resqflow/backend express cors helmet cookie-parser express-rate-limit dotenv zod socket.io @prisma/client@^6 bcryptjs jsonwebtoken` | OK — 99 packages |
| 7 | Backend dev deps incl. `prisma@^6` (first attempt) | FAILED: `@prisma/engines` postinstall `ECONNRESET` downloading engine binaries |
| 8 | Retry #7 (`typescript@~5.8.3 @types/* tsx vitest supertest @types/supertest`, without prisma) | OK |
| 9 | `PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma npm install -w @resqflow/backend -D prisma@^6` | OK (slow, ~7 min) — workaround for the engine-download failure |
| 10 | `npm run db:generate` (with the same mirror env) | OK — Prisma Client v6.19.3 generated |
| 11 | `npm run build` | Backend `tsc` OK. Frontend initially FAILED: TS 7 removed `baseUrl` → removed `baseUrl` (kept `paths`) → rebuilt OK |
| 12 | Backend start path fix: `rootDir` set to `src` so output is `dist/index.js` (was `dist/src/index.js`) | Rebuilt OK |
| 13 | `npm test` | OK — backend health test 1/1 passed; frontend `cn()` test 1/1 passed |
| 14 | `npm run lint` (frontend, oxlint) | OK — 0 errors, 2 warnings |
| 15 | Live server: `node backend/dist/index.js` + `curl /api/health` | OK — `{"status":"ok","service":"resqflow-backend","phase":0,...}` |
| 16 | Dev smokes: `tsx backend/src/index.ts` and Vite dev server | Both OK — health JSON returned; frontend HTML served on :5173 |
| 17 | `docker compose up` | NOT RUN — Docker CLI unavailable here. `docker-compose.yml` was YAML-parsed and structure-verified (services: postgres, backend, frontend; volume: resqflow_postgres_data) |

Notes: On a normal network, step 9's mirror env is unnecessary — plain `npm install` should fetch Prisma engines from the default CDN. No real credentials were created; `.env.example` contains only local placeholder defaults, and the local `.env` is git-ignored and excluded from the Phase 0 ZIP.

## Phase 1 additions
- `npm install -w @resqflow/frontend @radix-ui/react-{dialog,tabs,avatar,separator,progress,select,label,dropdown-menu}` — OK (45 packages).
- `npm run build -w frontend` — first failure: Button lacked `ghost` variant used by Notifications page → added `ghost`/`link` variants and `icon` size → build passed.
- Route code-splitting with `React.lazy` — production build emits a separate chunk per page (26 page chunks).

## Phase 2 additions
- Docker still unavailable → PostgreSQL 16.15 installed via apt, local cluster on :5432, user `resqflow`, DBs `resqflow` + `resqflow_test` (same credentials as docker-compose.yml).
- `PRISMA_ENGINES_MIRROR=... npx prisma migrate dev --name init` — migration `20261101132418_init` created and applied; `migrate deploy` applied to the test DB.
- `npx prisma db seed` — demo data seeded; verified by psql counts.
- `npm test -w backend` — 21/21 API tests passed (test DB). Root `npm test` also re-run at phase end.
- Live curl checks against the built server (health/logins/incident create/analytics/docs) + psql persistence check + Socket.IO client check — all passed.

## Phase 3 additions
- `npx prisma migrate dev --name add_auth_sessions` — User.tokenVersion added; applied to dev + test DBs.
- `npm run db:seed-admin` with env credentials — ops-admin@resqflow.local created (ACTIVE ADMIN).
- `npm test -w backend` — 30/30 (21 Phase 2 + 9 new authz tests) against resqflow_test.
- Live E2E via Vite proxy with a curl cookie jar — login/me/CSRF/401 checks all passed.

## Phase 4 additions
- Migration `20261101134619_sos_workflow_priority` generated via `prisma migrate diff` (migrate dev is interactive-only here), enum conversions use CASE mappings (REPORTED→SUBMITTED, VERIFIED→ACKNOWLEDGED, NEW→SUBMITTED, TEAM_ASSIGNED→ASSIGNED); verified by deploying all migrations from scratch on empty dev + test DBs.
- `npm test -w backend` — 37/37 (adds workflow.test.ts: priority rules + full SOS workflow E2E).
- Live workflow via the Vite proxy reproduced the brief's chain exactly (submit→ack→assign→progress→resolve→citizen view).

## Phase 5 additions
- Migration `shelter_accessibility` via prisma migrate diff + deploy (dev + test DBs).
- `npm test -w backend` — 47/47 (adds external.test.ts and shelters.test.ts; fetch stubbed, no network in tests).
- Live check: GET /api/external/overview returned real Open-Meteo/GDACS/USGS data with cache-verified fetchedAt; map routes 200.

## Phase 6 (1 Nov 2026)
- Backend: `npm i -D socket.io-client`; socket auth hardening (mandatory JWT/cookie +
  tokenVersion), scoped emits, SOS acknowledgement notification, shelter events,
  analytics expansion; new `src/realtime.test.ts`.
- Frontend: `npm i socket.io-client`, `npm i -D vite-plugin-pwa`; icons generated with
  Python PIL into `frontend/public/icons/`.
- PostgreSQL restore after VM replacement: apt stalled on the egress proxy
  (system apt proxy config has no credentials; credentialed config fixed most suites but
  noble-security/backports still returned 407 via the IPv6 proxy endpoint).
  Working route: `python3 -m venv .pg-venv && .pg-venv/bin/pip install pgserver`;
  copied `pginstall` + `pgserver.libs` to `/opt/resqflow-pgsql` (wheel RPATH needs the
  libs dir on LD_LIBRARY_PATH); `useradd -r pguser`;
  `runuser -u pguser -- env LD_LIBRARY_PATH=/opt/resqflow-pgsql/pgserver.libs:/opt/resqflow-pgsql/lib /opt/resqflow-pgsql/bin/initdb -D /var/lib/resqflow-pgdata -U resqflow --auth-host=scram-sha-256 --auth-local=trust`;
  `pg_ctl ... -o "-p 5432 -h 127.0.0.1" start`; createdb resqflow + resqflow_test;
  `prisma migrate deploy` (both DBs) with PRISMA_ENGINES_MIRROR; `npm run db:seed`.
  Helper committed as `scripts/pg-local.sh`. (Credentialed apt proxy config file created
  during diagnosis was removed afterwards.)
- Tests: backend 54/54, frontend 1/1, root build green, lint 0 errors.

## Phase 6 audit (1 Nov 2026)
- `bash scripts/pg-restore.sh` — one-command PostgreSQL rebuild after VM replacement
  (created this session; also recreates `pguser`). Supersedes the manual /opt steps.
- Fixes: CORS_ORIGIN comma-list (env.ts transform; .env/.env.example updated),
  audit actorEmail filter (validator + service), AppShell real unread badge + realtime
  status + dead search removed, LandingPage on real public APIs, previewData.ts deleted,
  PublicLayout footer copy, PreviewBanner removed, NotificationsPage effect deps.
- Live checks: cookie-header socket E2E script (anonymous rejected; SOS scoping;
  acknowledgement notification), CORS headers from :4173, audit filter, admin CRUD.
