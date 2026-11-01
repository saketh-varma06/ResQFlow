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

- [ ] A. Restore runtime: PostgreSQL (pg-restore.sh), backend :4000, frontend :5173; verify /api/health.
- [ ] B. Initial local git commit (verify .gitignore excludes node_modules/.env/dist first).
- [ ] C. Backend audit: exercise every endpoint group live; fix real defects; write docs/BACKEND_AUDIT.md.
- [ ] D. Critical DB tests on the current PostgreSQL: registration+hashing, login/invalid login, SOS create+retrieve, incident status+history, shelter persistence, restart persistence, authorization matrix. Record real results in docs/TEST_REPORT.md.
- [ ] E. MongoDB Atlas preparation (non-destructive): docs/DATABASE_DESIGN.md (Postgres design + full Mongo mapping), code-ready Mongoose layer in database/mongodb/ (10 collections, validation, indexes incl. 2dsphere GeoJSON, connection + health check), migration plan, MONGODB_URI placeholder in .env.example.
- [ ] F. Docs: DEPLOYMENT_GUIDE.md, REQUIRED_CREDENTIALS.md (tomorrow's checklist with official links).
- [ ] G. Final verification: root build, full test suites, lint; servers left running; summary in this log.

## Log

- 23:34 IST — Round started. Servers found down (VM cycled); DB state to be restored in step A.
