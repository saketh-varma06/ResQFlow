# Phase 3 — Real authentication & RBAC (complete)

## Session strategy
- Password hashing: bcrypt (bcryptjs, 12 rounds) — unchanged from Phase 2.
- Login/register issue a JWT (7-day expiry) delivered two ways: as an **httpOnly, SameSite=Lax cookie** `resqflow_session` (Secure in production) for the web app, and in the JSON body for Bearer clients (API/tests/Socket.IO).
- **Session invalidation:** every user has a `tokenVersion` (migration `add_auth_sessions`). The JWT carries `tv`; `requireAuth` rejects any token whose `tv` no longer matches. **Logout and password change increment `tokenVersion`**, killing every previously issued token on every device.
- **CSRF:** login also sets a readable `resqflow_csrf` cookie (double-submit). Mutating requests authenticated by cookie must send `x-csrf-token` matching it; Bearer requests are exempt (not ambient). The frontend API client adds the header automatically.
- **Rate limiting:** `/api/auth/login` 20 attempts / 15 min / IP, other auth routes 60 / 15 min, global API 600 / 15 min.
- **CORS:** single configured origin with credentials. In development the Vite dev server proxies `/api` to :4000, so cookies are first-party.
- **Registration privilege rule:** public registration with role RESPONDER or ADMIN creates a **PENDING** account and issues **no token**; login is refused (403) until an admin activates the account (PATCH /api/users/:id) — verified by tests.
- Every protected route runs `requireAuth` (cookie or Bearer) + `requireRole` on the backend; record-level rules live in services (citizens scoped to their own SOS/notifications, responders restricted to incidents assigned to their unit, shelter/alert/user/analytics/audit admin rules).

## Role capabilities added/confirmed this phase
- Responder **response notes**: `POST /api/incidents/:id/notes` (assigned unit or admin) — appends a timeline entry and notifies the reporter.
- Responder **availability**: `PATCH /api/responders/me/availability { readiness }`.
- Everything from Phase 2 (citizen SOS/report/track/notifications; admin user/responder/incident/alert/shelter management, assignment, analytics, audit) remains behind the same guards.

## Safe admin seeding
`npm run db:seed-admin` (backend/prisma/seed-admin.ts) — env-driven (`ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` ≥ 12 chars), upserts an ACTIVE ADMIN, never prints the password, refuses the demo password when NODE_ENV=production. Verified live by creating ops-admin@resqflow.local. The demo seed (prisma/seed.ts) remains local-development only.

## Frontend wiring
- `src/lib/api.ts` — fetch client with `credentials: include` + automatic CSRF header.
- `src/context/AuthContext.tsx` — session state from `GET /api/auth/me`, login/register/logout actions.
- `src/components/auth/ProtectedRoute.tsx` — guards `/citizen/*` (CITIZEN), `/responder/*` (RESPONDER), `/admin/*` (ADMIN); anonymous users go to `/login?next=…`, wrong-role users go to their own home.
- Login/Register pages call the real API (fake local-only logic and role-preview links removed); sidebars and the public header show the **real signed-in user** and a working Sign out; the hardcoded preview identities are gone.
- Page content (dashboards, tables) still uses the Phase 1 labelled preview data — connecting those screens to the APIs is the next phase.

## Tests (all actually run)
- New `backend/src/authz.test.ts` — 9 tests: httpOnly cookie issuance + cookie-authenticated reads, CSRF 403 without header / 201 with it, logout invalidates the old token, expired token 401, password change invalidates old session + old password, PENDING responder cannot log in, citizen blocked from admin APIs, unassigned responder blocked from status/notes on someone else's incident, assigned responder notes + status work, availability update.
- Phase 2 suite still green: **30/30 backend tests total**, plus frontend test 1/1.
- Live end-to-end through the Vite dev origin (:5173 proxy → :4000): proxy login set cookies, /me returned the seeded citizen, SOS without CSRF → 403, with CSRF → 201, wrong password → 401, unauthenticated /api/users → 401.
