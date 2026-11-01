# Phase 2 — Backend (complete)

## Database
PostgreSQL via Prisma. 10 models: User, ResponderProfile, Incident, SOSRequest, Shelter, DisasterAlert, Notification, IncidentAssignment, IncidentStatusHistory, AuditLog — with enums (roles, statuses, severity, types), FK relations with onDelete rules, unique constraints (User.email/phone, ResponderProfile.userId, IncidentAssignment(incidentId, responderProfileId)), composite/plain indexes, createdAt/updatedAt throughout.
Migration: `backend/prisma/migrations/20261101132418_init/` (applied to the dev DB and `migrate deploy`-ed to the test DB).
Seed: `backend/prisma/seed.ts` (idempotent reset + demo data). Demo accounts (LOCAL ONLY): admin@resqflow.local/Admin@12345, citizen@resqflow.local/Citizen@12345, responder@resqflow.local + fire@resqflow.local / Responder@12345.

## How the database was run here (honest note)
Docker is not installed in this build environment, so `docker compose up` could not be used here. Instead PostgreSQL 16.15 was installed from Ubuntu packages and run as a local cluster on localhost:5432 with user `resqflow` and databases `resqflow` + `resqflow_test` — the exact credentials the committed `docker-compose.yml` and `.env.example` use, so on any Docker machine the Compose route works unchanged. Backend/.env for this machine was generated locally with a random JWT secret (crypto.randomBytes) and is git-ignored.

## API (all under /api, JWT Bearer, Zod-validated, { data } / { data, meta } shapes)
- Auth: POST register (citizens ACTIVE; RESPONDER/ADMIN created PENDING, no token), POST login, GET me, POST logout, POST change-password. bcrypt + JWT; failed logins write DENIED audit entries.
- Users: GET (ADMIN), GET /:id, PATCH /users/me, PATCH /:id (ADMIN role/status), DELETE /:id (ADMIN).
- Incidents: POST, GET (filters + pagination), GET /:id (assignments + history), PATCH, PATCH /:id/status (ADMIN or assigned unit; history + reporter notification + socket event), POST /:id/assign (ADMIN), POST /:id/accept|decline|complete (RESPONDER), DELETE (ADMIN).
- SOS: POST, GET (citizens scoped to own), GET /:id, PATCH /:id/status, POST /:id/assign (responder self-assign / admin).
- Responders: GET, GET /:id, GET /me/profile, POST (ADMIN — existing userId or new account), PATCH, DELETE (ADMIN).
- Shelters: GET (public), GET /:id, POST/PATCH/DELETE (ADMIN) — occupancy validation, status derived from occupancy (FULL ≥100%, NEARLY_FULL ≥90%) unless CLOSED.
- Alerts: GET (non-admins see ACTIVE only), GET /:id, POST/PATCH/DELETE (ADMIN) — ACTIVE alerts create notifications for citizens in the area and record reach.
- Notifications: GET (unreadOnly), GET /unread-count, POST /read-all, PATCH /:id/read, DELETE /:id — always scoped to the caller.
- Analytics: GET /overview (ADMIN/RESPONDER) — counts by role/status/severity/type, SOS by status, shelter occupancy, last-7-days series, avg resolution time.
- Audit: GET, GET /:id (ADMIN only).
- Docs: GET /api/docs (Swagger UI), GET /api/docs.json (OpenAPI 3.0.3, 35 paths). Spec source: `backend/openapi.yaml`.
- Realtime: Socket.IO with JWT handshake auth; rooms user:<id> and role:<ROLE>; events notification:new, incident:created/updated/assigned, sos:created/updated, alert:created/updated.

## Structure
backend/src/{config, database, routes, controllers, services, middleware, validators, utils, types, socket, docs} — routes wire middleware, controllers are thin, services own Prisma + audit + notification + realtime side-effects.

## Verification (actually run)
- `prisma validate` ✓, migration created + applied ✓, seed ✓ (psql counts: 5 users, 2 units, 5 incidents, 3 SOS, 4 shelters, 3 alerts, 3 notifications, 2 assignments, 10 history, 3 audit).
- Automated tests: `backend/src/api.test.ts` — 21/21 passed against the dedicated `resqflow_test` database (auth, RBAC, incident assignment lifecycle, SOS flow, shelter rules, alert fan-out, notifications, analytics, audit).
- Live built server: /api/health database "up", seed logins, incident created over HTTP and read back from PostgreSQL with psql, analytics aggregates, Swagger 200s, Socket.IO anonymous + authenticated connections verified; data survived a server restart.
- A serialization bug found by the live check (dates returned as {}) was fixed in services/serialize.ts and covered by a new test assertion.
