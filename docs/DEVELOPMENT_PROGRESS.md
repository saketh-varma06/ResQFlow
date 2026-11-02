# ResQFlow — Development Progress Log

Maintained by saketh during autonomous work. If work is interrupted, resume from
the "Next steps" section. All results recorded here are from commands actually run.

## Environment facts (verified 1 Nov 2026, 23:34 IST)

- The project lives in a **persistent cloud workspace** (`~/workspace/disaster-management-platform/`)
  on the assistant's VM — it does NOT depend on the user's PC. User PC shutdown has
  no effect on the workspace or on background work.
- Workspace files persist across VM replacements (proven: the project survived two
  VM replacements on 1 Nov 2026). **Running processes do not persist** — servers and
  the sandbox PostgreSQL (user-space, in /opt + /var/lib) must be restarted after a
  replacement: `bash scripts/pg-restore.sh`, then start backend/frontend.
- As of 23:34 IST the backend/frontend processes were DOWN (VM cycled after the
  21:23 tunnel session) — restart is step 1 of this round.
- Git: the repository had **never been committed** (all files untracked) — an
  initial local commit is step 2 of this round to protect the work. No GitHub
  remote is configured (user will authorize tomorrow).

## Tonight's mandate (user brief, 1 Nov 2026 23:33 IST)

Complete every credential-independent task; do NOT request accounts/keys; user
provides MongoDB Atlas + hosting authorizations tomorrow. Prepare the Atlas
integration without destroying the working PostgreSQL stack; never claim Atlas is
connected before a real connection test with real credentials.

## Work plan

- [x] A. Restore runtime: PostgreSQL (pg-restore.sh), backend :4000, frontend :5173; verify /api/health.
- [x] B. Initial local git commit (verify .gitignore excludes node_modules/.env/dist first).
- [x] C. Backend audit: exercise every endpoint group live; fix real defects; write docs/BACKEND_AUDIT.md.
- [x] D. Critical DB tests on the current PostgreSQL: registration+hashing, login/invalid login, SOS create+retrieve, incident status+history, shelter persistence, restart persistence, authorization matrix. Record real results in docs/TEST_REPORT.md.
- [x] E. MongoDB Atlas preparation (non-destructive): docs/DATABASE_DESIGN.md (Postgres design + full Mongo mapping), code-ready Mongoose layer in database/mongodb/ (10 collections, validation, indexes incl. 2dsphere GeoJSON, connection + health check), migration plan, MONGODB_URI placeholder in .env.example.
- [x] F. Docs: DEPLOYMENT_GUIDE.md, REQUIRED_CREDENTIALS.md (tomorrow's checklist with official links).
- [x] G. Final verification: root build, full test suites, lint; servers left running; summary in this log.

## Log

- 23:34 IST — Round started. Servers found down (VM cycled); DB state to be restored in step A.
- 23:37 IST — A DONE: pg-restore.sh completed (DBs resqflow + resqflow_test migrated, dev seeded). Root build passed (backend tsc + frontend vite build). Backend running on :4000 — GET /api/health → status ok, database up. Frontend dev on :5173 → HTTP 200.
- 23:38 IST — B DONE: .gitignore verified (node_modules/, .env/.env.* with !.env.example exception, dist/, .pg-venv/ all covered). Initial local commit **b61a6a2** (211 files staged; 0 real .env files — only .env.example templates). No remote configured (GitHub authorization comes tomorrow).
- ~23:40 IST — F DONE: docs/DEPLOYMENT_GUIDE.md (453 lines) and docs/REQUIRED_CREDENTIALS.md (444 lines) written from the actual project files. Deployment guide honestly flags: Docker path written/YAML-verified but never executed here, compose ships a localhost CORS_ORIGIN and no auto-migration step, health endpoint returns HTTP 200 even when database is "down" (check the body). Credentials checklist carries the never-share-passwords/OTPs rule and ends with user-only vs assistant-after-authorization task lists. Minor observation: `API_URL` appears in the .env.example templates but is not read by the backend env schema (documented as a reference value only).
- ~23:44 IST — C DONE: docs/BACKEND_AUDIT.md written. **112 live HTTP checks** (91 primary + 21 follow-up probes) across every API group, per-role cookie jars + CSRF + Bearer; only 9 logins (rate limiter untouched). **Defects found: NONE in any area — no code edits, no rebuild, no restart needed.** Verified live: PENDING responder flow (register → 403 login → admin activation → login works), tokenVersion invalidation on logout (old Bearer also 401), workflow skip → 400 naming allowed transitions, full incident chain to CLOSED, SOS cancel via PATCH status (no /cancel route exists), shelter capacity/shrink validation 400s, audit-log actorEmail filter genuinely filtering, analytics keys (trends14Days nested under `incidents`), /api/docs.json = 39 paths. Observations: GDACS briefly returned honest `unavailable` then recovered with 12 real items (designed degradation); decline leaves incident at ASSIGNED pending re-assignment. Backend left running (health 200, database up).
- ~23:41 IST — E DONE: docs/DATABASE_DESIGN.md written (PostgreSQL design + full Atlas design + migration/rollback plan). **Correction to earlier records: the Prisma schema defines 11 models, not 10** — the Mongo design maps them to 10 collections by unifying IncidentStatusHistory + SOSStatusHistory into one statusHistory collection with an entityType discriminator. Code-ready layer in database/mongodb/ (mongoose ^8.9.5): connect.ts (clear error when MONGODB_URI unset), health.ts (never throws), 10 model files with Prisma-mirroring validation + 2dsphere GeoJSON indexes; `npx tsc --noEmit` PASSES; runtime smoke test confirms the not-connected behaviour and no invented connection string anywhere. Design choices documented: responders = separate collection referencing users; assignments/statusHistory = referenced collections, not embedded; Postgres cuids preserved as Mongo string _ids. MONGODB_URI= placeholder + comment added to root and backend .env.example (grep-verified). **Atlas is NOT connected — preparation only.**
- ~23:42 IST — D DONE: **7/7 critical database tests PASS** on PostgreSQL, appended to docs/TEST_REPORT.md. Evidence: fresh citizen registered (passwordHash = bcrypt, 60 chars, $2b$ prefix, ≠ plaintext in the DB row); login 200 / wrong password 401; SOS created + read back + rows confirmed in SOSRequest/SOSStatusHistory; incident SUBMITTED→ACKNOWLEDGED persisted with 2 IncidentStatusHistory rows; shelter occupied 10→47 persisted (available recomputed 153); **backend killed (PID 2513) and restarted (PID 3571) — SOS, shelter and incident all re-fetched with identical ids and statuses**; authorization matrix 403/401/403 as expected.
- ~23:47 IST — G DONE: root build **0 TypeScript errors**; tests **backend 57/57, frontend 1/1**; lint **0 errors** (10 warnings); `prisma migrate status` — 4 migrations, schema up to date. Prisma model count independently re-verified: **11 models**. Servers left RUNNING: backend :4000 (PID 3571, health ok + database up), frontend :5173 (PID 2536, HTTP 200).
- Round complete. Remaining for tomorrow (user action): Atlas credentials, GitHub authorization, hosting accounts — see docs/REQUIRED_CREDENTIALS.md. Known non-blocking observations: GDACS can briefly report honest `unavailable` under upstream slowness (recovers, never fabricates); Docker deployment path never executed in this sandbox; Playwright browser binary still not installable here (specs ready in e2e/).
- 2 Nov, ~11:55 IST — Atlas round: connection string placed in backend/.env (git-ignored; direct shard-host form because the sandbox resolver refuses SRV — TLS to shard-00-00 verified OK, replica set atlas-10x10p-shard-0). database/mongodb verify script added (npm run verify): 8 real checks (connect/ping, indexes incl. 2dsphere, bcrypt storage, wrong-password rejection, SOS+GeoJSON round-trip, status history, $near near/far). Typecheck passes; run stops cleanly at the <db_password> placeholder — the password value is the only missing input (Atlas never displays it). Browser automation opened Atlas for network-access + DB-user readiness (user signs in via secure card).
