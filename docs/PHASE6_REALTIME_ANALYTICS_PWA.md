# Phase 6 — Realtime communication, notifications, analytics & PWA

## 1. Realtime (Socket.IO) — authenticated and role-scoped
- **Authentication is now mandatory.** `backend/src/socket/index.ts`: the handshake token
  (auth payload or `token` query) or the `resqflow_session` httpOnly cookie is verified,
  the user is loaded, `payload.tv` must equal `User.tokenVersion`, and the account must be
  ACTIVE. Anonymous connections are rejected with "Authentication required"; a token
  invalidated by logout/password change is rejected with "Session has been invalidated".
- Rooms: `user:<id>` (personal) and `role:<ROLE>` (feeds).
- **Visibility:** `sos:*` → RESPONDER/ADMIN rooms (+ citizen owner for updates);
  `incident:created` → RESPONDER/ADMIN; `incident:updated` → RESPONDER/ADMIN + the reporter
  (previously broadcast to everyone); `incident:assigned` → the assigned unit's user;
  `alert:*` and `shelter:*` → all authenticated role rooms (same data every role may read
  via REST); `notification:new` → the recipient's user room only.
- Frontend: `src/lib/socket.ts` + `RealtimeProvider` connect with the session cookie when
  logged in; toast cards surface new SOS (responders/admins), assignments (responder),
  alerts (all), and notifications; pages subscribe to raw events for live refresh
  (notifications page reloads on `notification:new`).

## 2. Database-backed notifications — trigger coverage
All notifications are DB rows + `notification:new` socket events: SOS created (responders),
**SOS acknowledged (specific wording to the citizen)**, SOS assigned/status/resolved,
incident assignment ("New incident assignment" to the unit), incident status changes
(reporter), notes (reporter), ACTIVE alerts (area citizens, reach counted). Mark-as-read
and read-all were already owner-scoped; the realtime suite verifies DB persistence +
mark-read round trip.

## 3. Analytics — real computations, no hardcoded values
`GET /api/analytics/overview` (admin/responder) now also returns:
- `incidents.trends14Days` — per-day reported / resolved (from status history) / SOS counts.
- `sos.pending` + `sos.oldestPendingMinutes`.
- `response.avgAcknowledgementMinutes {incidents, sos}` and `avgResolutionMinutes` —
  minutes from creation to the FIRST history entry reaching ACKNOWLEDGED / RESOLVED.
- `shelters.utilizationPercent` + `perShelter[]` (capacity/occupied/available/utilization).
- `responderWorkload[]` — active vs completed assignments and SOS per unit.
Admin Analytics page charts these with Recharts (severity bars, category pie, 14-day area
trends, shelter utilization bars, workload table). Admin Dashboard, Alert Management,
User Management, Responder Management and Audit Logs are also fully wired — **no page in
the app uses preview data anymore.**

## 4. PWA & offline behaviour
- vite-plugin-pwa: installable manifest (name/icons/theme, generated life-ring icons),
  service worker precaches the app shell; runtime caching: OSM tiles CacheFirst (7 days),
  `/api/shelters` + `/api/alerts` NetworkFirst (last-known data offline, 24 h max).
- **Offline honesty rules (implemented in `src/lib/outbox.ts` + `OutboxBar`):**
  a request counts as sent ONLY when the server responds with success + its ID.
  Network/5xx failures on SOS or incident reports enqueue the payload in a localStorage
  outbox, show "NOT sent yet — saved on this device only", and retry automatically on
  reconnect/`online`; the outbox bar confirms receipt with the server ID after a flush.
  Server rejections (4xx) are surfaced as failed items, never silently dropped.
  Report form drafts persist locally across reloads.

## 5. Environment incident during this phase (PostgreSQL restore)
The sandbox VM was replaced mid-phase: the apt-installed PostgreSQL (outside $HOME) was
gone, which initially looked like a mass test regression (every suite failed at DB connect).
apt reinstall then stalled behind the egress proxy (unauthenticated apt proxy config;
407s on some suites). Resolution: **user-space PostgreSQL 16.2** from the `pgserver`
wheel — binaries copied to `/opt/resqflow-pgsql`, data in `/var/lib/resqflow-pgdata`,
running as unprivileged user `pguser` on 127.0.0.1:5432; helper: `scripts/pg-local.sh`
(start/stop/status/psql). Databases were recreated empty, all migrations re-applied and
the dev DB re-seeded (no real data existed). `/opt` + `/var/lib` do not survive another
VM replacement; on a normal machine use the committed docker-compose.yml instead.

## 6. Verification actually run
- Backend tests **54/54** (47 previous + 7 new `realtime.test.ts`: unauthenticated socket
  rejected; logout-invalidated token rejected; SOS reaches responder socket but not other
  citizens; acknowledgement → citizen socket + DB notification + mark-read; assignment
  event + notification to the unit only; ACTIVE alert broadcast + notification; shelter
  update broadcast; analytics shape/values). A test bug found on first run (logout test
  reused a shared fixture token, invalidating it for later tests) was fixed by using a
  throwaway account — the production invalidation behaviour was correct.
- Root build green; root tests 54 + 1; lint 0 errors.
- Live through the Vite proxy: citizen login → SOS created → responder login →
  acknowledgement (200) → citizen notification list shows "SOS acknowledged"; admin
  analytics returned 14 trend days, pending SOS, shelter utilization and workload from
  the seeded data; preview server returned HTTP 200 for the app, `/manifest.webmanifest`,
  `/sw.js`, icons, and all admin/citizen routes.
- Not verifiable here (stated honestly): visual browser inspection (browser tool rejects
  loopback) and a true offline-device PWA test — the outbox logic is covered by code
  review and build output (manifest + sw.js present in `dist/`), not by an offline run.

## 7. Post-phase audit (1 Nov 2026, user's instruction — no new phase)
Full re-inspection of the Phase 6 implementation: builds, tests, workflows re-run.
Bugs found and FIXED:
1. **CORS single-origin** — `CORS_ORIGIN` allowed only the :5173 dev origin, so the
   :4173 preview (and any other host) could not open the direct socket connection.
   Now a comma-separated allowlist (env transform), applied to REST and Socket.IO;
   verified live: `Access-Control-Allow-Origin: http://localhost:4173` on the socket
   handshake, foreign origins not reflected.
2. **Audit-log actor filter silently ignored** — the page sends `actorEmail` but the
   backend only accepted `actorId`/`search`. Added `actorEmail` (contains,
   case-insensitive) to the validator + service; verified live (exact-actor filtering).
3. **Fake notification badge** — AppShell hard-coded badge "3". Now the real
   `/api/notifications/unread-count`, refreshed on `notification:new`; hidden at 0.
4. **Dead search box + fake status chip in AppShell** — the header search had no
   handler at all (removed), and "Operations normal · Preview" was static text;
   replaced with the REAL realtime connection state (Live / Reconnecting…).
5. **Stale Phase 1 leftovers** — LandingPage still rendered sample incidents/alerts/
   shelters from `previewData.ts` (labelled, but mock data in the shipped app) and its
   role buttons linked to `/citizen` etc. claiming "previews… no sign-in" — false since
   Phase 3 (they bounce to login). Landing now uses the REAL public APIs (shelters and
   alerts are `optionalAuth` reads): live shelter map + capacity strip + active alerts,
   honest unavailable states when the API is down; role CTAs go to `/login` with correct
   copy. `previewData.ts` deleted — zero mock-data imports remain. PublicLayout footer
   copy ("preview data until the data-wiring phase") corrected; unused `PreviewBanner`
   component removed.
6. **NotificationsPage effect churn** — realtime subscription re-created on every
   render (unstable object dep); now keyed on the stable `reload` callback.
Verified after fixes: root build green; backend 54/54 + frontend 1/1; live cookie-path
socket E2E (the browser's exact path: anonymous rejected, cookie connects per role,
SOS → responder only, acknowledgement → citizen notification); admin CRUD live
(responders create/patch/delete, alerts create/publish/delete); public shelters/alerts
200 with server-computed `available`; preview serves app + manifest + sw.js (200s).
Environment note: the VM was replaced AGAIN between turns (PostgreSQL gone a second
time). Root cause of the earlier in-$HOME user-space failure also found: the home
mount is idmapped — only root can read it, and PostgreSQL refuses root — so binaries
and data must live in /opt + /var/lib under `pguser`. `scripts/pg-restore.sh` now
rebuilds everything (user, cluster, DBs, migrations, seed) in ~25 s; run it after
any sandbox replacement before judging test failures.
