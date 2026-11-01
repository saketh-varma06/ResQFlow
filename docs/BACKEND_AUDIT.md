# ResQFlow — Live Backend Audit (Step C)

**Date:** 1 Nov 2026 (IST, evening) · **Environment:** sandbox, backend `http://localhost:4000` (PID 2513, left RUNNING), frontend dev `:5173`, user-space PostgreSQL 16.2 restored + seeded.
**Scope:** every API group exercised live against the running backend — auth, incidents, SOS, shelters, alerts, notifications, responders, users, analytics, audit logs, external data, docs/health.
**Method:** scripted `curl` runs (Python driver) with per-role cookie jars (`-c`/`-b`), CSRF double-submit header (`x-csrf-token` read from the `resqflow_csrf` cookie) for cookie-authenticated mutations, and Bearer tokens where CSRF-exemption was being verified. Logins were economised (9 successful/attempted logins total across the whole audit, well under the 20/15 min login limiter; jars reused per role). **112 HTTP checks in total** (91 in the primary scripted pass + 21 targeted follow-up probes). No backend code was changed — see "Defects" below.

Demo accounts used: `admin@resqflow.local`, `citizen@resqflow.local`, `responder@resqflow.local` (River Rescue 12), `fire@resqflow.local` (Fire & Rescue 3). Audit-created data is prefixed `Audit … 556448` (users `auditcit556448@` / `auditresp556448@resqflow.local`) and remains in the dev DB as evidence.

---

## Per-area findings

### Health & docs — no defects
| Endpoint | Result |
|---|---|
| `GET /api/health` | 200 — `{status:"ok", database:"up", environment:"development"}` |
| `GET /api/docs.json` | 200 — OpenAPI spec with **39 paths** |
| `GET /api/incidents/<bad-id>` | 404 `{error:"Incident not found"}` |
| `GET /api/does-not-exist` | 404 `{error:"Route not found"}` |

### Auth — no defects
| Check | Result |
|---|---|
| `POST /api/auth/login` admin / citizen / responder (valid) | 200 each, correct roles, `data.token` (Bearer) + session & CSRF cookies set |
| `POST /api/auth/login` wrong password | 401 `{error:"Invalid email or password"}` (no user-enumeration leak) |
| `POST /api/auth/register` CITIZEN | 201, user `status:"ACTIVE"`, token issued |
| `POST /api/auth/register` RESPONDER | 201, user `status:"PENDING"`, **no token** in response |
| `POST /api/auth/login` as PENDING responder | 403 `{error:"This account is pending approval"}` |
| `POST /api/auth/register` duplicate email | 409 `{error:"An account with this email already exists"}` |
| `POST /api/auth/register` invalid body | 400 with per-field Zod details (name/email/password) |
| `GET /api/auth/me` (cookie) | 200, correct user |
| `GET /api/auth/me` anonymous | 401 |
| `POST /api/auth/logout` → `GET /me` same jar | 200 → **401** (cookie cleared: "Not signed in") |
| `GET /me` with the **pre-logout Bearer token** | **401** `{error:"Session has been invalidated — sign in again"}` — proves `tokenVersion` invalidation, not just cookie clearing |

### Incidents — no defects
| Check | Result |
|---|---|
| `GET /api/incidents` citizen | 200 — by design the list is visible to any authenticated user (OpenAPI: "filters … mine"; the project's own tests rely on this); `?mine=true` correctly scoped the citizen to **5 of 7** total |
| `GET /api/incidents` anonymous | 401 |
| `POST /api/incidents` citizen (valid) | 201, `status:"SUBMITTED"`, priority computed (MEDIUM/46 for the audit payload) |
| `POST /api/incidents` invalid body (`{title:"x"}`) | 400 with field-level errors (title min-length, missing type enum, …) |
| `GET /api/incidents/:id` | 200 |
| `PATCH /:id/status` **skipped** SUBMITTED→RESOLVED | **400** — `Invalid status transition SUBMITTED → RESOLVED. Allowed from SUBMITTED: ACKNOWLEDGED, CANCELLED, CLOSED.` (allowed transitions named, as required) |
| Full valid chain on one incident | SUBMITTED →(admin PATCH) ACKNOWLEDGED →(admin assign) ASSIGNED →(responder accept / PATCH) IN_PROGRESS →(responder complete) RESOLVED →(admin PATCH) CLOSED — every step 200 |
| `POST /:id/assign` (admin → River Rescue 12) | **201** returning the `IncidentAssignment` (`status:"PENDING"`) — this is the documented OpenAPI behaviour ("201 Assignment"), and the incident itself moved to ASSIGNED |
| `POST /:id/assign` as citizen | 403 |
| `POST /:id/accept` (assigned responder) | 200, assignment ACCEPTED; follow-up GET proved the incident was **immediately IN_PROGRESS** (spec: "accept → IN_PROGRESS") |
| `POST /:id/complete` (assigned responder) | 200, assignment COMPLETED and incident moved to RESOLVED (verified by GET before closing it) |
| `POST /:id/decline` (assigned responder, 2nd incident) | 200, assignment DECLINED (see Observation 2 for the incident-status nuance) |
| `POST /:id/notes` assigned responder | 201, timeline entry written |
| `POST /:id/notes` citizen / **unassigned** unit (Fire & Rescue 3 on a River incident) | 403 / 403 `This incident is not assigned to your unit` |
| `PATCH /:id/status` citizen / unassigned responder | 403 `Citizens cannot change incident status` / 403 `This incident is not assigned to your unit` |

### SOS — no defects
Route discovery: there is **no** dedicated cancel endpoint — cancellation is `PATCH /api/sos/:id/status` with `status:"CANCELLED"` (matches `sos.routes.ts`, the service guard, and `workflow.test.ts`).
| Check | Result |
|---|---|
| `POST /api/sos` citizen with `category:"FLOOD"`, trapped, 1 injury | 201, SUBMITTED, priority **HIGH/50** with explainable reasons (`Category: Flood (+28)`, `4 people affected (+3)`, `1 reported injury (+4)`, `People reported trapped (+15)`) |
| `POST /api/sos` invalid body (missing category) | 400 with field errors |
| `GET /api/sos` citizen | 200 — strictly own requests |
| Cross-citizen isolation | a second citizen's list returned **0** rows; `GET /api/sos/:id` of another citizen's SOS → **403** `You can only view your own SOS requests`; owner GET → 200 |
| `GET /api/sos` responder (inbox) | 200 — all requests (7 after audit creations); a newly created SOS appeared in the inbox immediately |
| `GET /api/sos/:id` | 200 — history field is **`statusHistory`** (present, ordered); no `history` field |
| `PATCH /:id/status` ACKNOWLEDGED (responder) | 200 |
| `POST /:id/assign` responder self-assign | 200, status ASSIGNED (responder is forced to their own profile server-side) |
| `PATCH` ASSIGNED→IN_PROGRESS→RESOLVED | 200 / 200 |
| Citizen cancels own SUBMITTED SOS (`PATCH status=CANCELLED`) | 200, status CANCELLED |
| Citizen tries to ACKNOWLEDGE own SOS | 403 `Citizens can only cancel their own SOS requests` |

### Shelters — no defects
| Check | Result |
|---|---|
| `GET /api/shelters` (public, no auth) | 200, 4 shelters; every row carries the server-computed **`available`** field (e.g. capacity 1200 / occupied 640 — `available` present in payload) |
| `GET /api/shelters?search=Community` | 200, exactly 1 match (North District Community Hall) — search actually filters |
| `POST /api/shelters` admin | 201, `available: 90` computed for capacity 100 / occupied 10 |
| `POST` occupied (50) > capacity (10) | **400** `occupied cannot exceed capacity` (Zod refine) |
| `POST` as citizen | 403 |
| `PATCH` shrink capacity 100→5 while occupied=10 | **400** `occupied cannot exceed capacity` (service-level check on merged values, not just the raw body) |
| `PATCH` occupied 10→25 (valid) | 200, `available` recomputed to 75 |
| `DELETE /api/shelters/:id` admin → `GET` it | 200 `{deleted:true}` → **404** |

### Alerts — no defects
| Check | Result |
|---|---|
| `GET /api/alerts` (public) | 200, 2 alerts |
| `POST /api/alerts` citizen | **403** |
| `POST /api/alerts` admin | 201 — fan-out verified downstream: the citizen's notification list grew and included the audit alert |
| `PATCH /api/alerts/:id` admin (severity→CRITICAL) | 200 |
| `DELETE /api/alerts/:id` admin | 200 |

### Notifications — no defects
| Check | Result |
|---|---|
| `GET /api/notifications` citizen | 200, 15 notifications (seed + SOS/alert fan-out from this audit) |
| `GET /api/notifications/unread-count` | 200 — exact shape **`{data:{unread:15}}`** |
| `PATCH /api/notifications/:id/read` | 200, `isRead:true` |
| `POST /api/notifications/read-all` | 200 `{data:{updated:14}}` (15 total − 1 already read) |
| `GET unread-count` after read-all | 200 `{data:{unread:0}}` |

### Responders — no defects
| Check | Result |
|---|---|
| `GET /api/responders` | 200 — order/content as seeded: **`Fire & Rescue 3` first, `River Rescue 12` present** (2 units) |
| `PATCH /api/responders/me/availability` responder (cookie + CSRF) | 200 — AVAILABLE set, then restored to DEPLOYED (200) |
| Same PATCH via **Bearer** (no CSRF header) | 200 — Bearer is CSRF-exempt, as designed |
| Same PATCH via cookie **without** CSRF header | **403** `CSRF check failed — send the x-csrf-token header matching the resqflow_csrf cookie` |

### Users (admin) — no defects
| Check | Result |
|---|---|
| `GET /api/users` admin | 200, 7 users (5 seed + 2 audit registrations), pagination meta `{total:7, page:1, limit:20, pages:1}` |
| `GET /api/users` citizen / responder | 403 / 403 |
| `PATCH /api/users/:id` activate the PENDING audit responder (`status:"ACTIVE"`) | 200, status ACTIVE — and the previously-403 login for that account then succeeded (200, role RESPONDER), closing the full registration→approval→login loop live |
| `PATCH /api/users/:id` profile field (area) | 200 |

### Analytics — no defects
| Check | Result |
|---|---|
| `GET /api/analytics/overview` admin | 200. Top-level keys: `users, incidents, sos, shelters, alerts, assignments, responderWorkload, response, generatedAt`. Required values all present and real: **`incidents.trends14Days`** = 14 day entries (2026-11-01: 7 incidents / 2 resolved / 6 SOS), **`sos.pending` = 1** with `oldestPendingMinutes`, **`shelters.utilizationPercent` = 72.8** (2039/2800) with `perShelter` breakdown, **`responderWorkload`** = 2 units. Note: `trends14Days` is nested under `incidents`, not top-level |
| `GET` analytics citizen | 403 |
| `GET` analytics anonymous | 401 |
| `GET` analytics responder | 200 — the route deliberately allows `ADMIN` + `RESPONDER` (`analytics.routes.ts`); recorded as designed behaviour, not a hole |

### Audit logs — no defects
| Check | Result |
|---|---|
| `GET /api/audit-logs` admin | 200, 20 rows (page limit) |
| `GET /api/audit-logs?actorEmail=admin@resqflow.local` | 200, 16 rows, **every row's `actorEmail` equals the filter** — the filter genuinely filters (regression from the Phase 6 audit stays fixed) |
| `GET …?actorEmail=citizen@resqflow.local` | 200, 9 rows, all citizen — distinct result set |
| `GET /api/audit-logs` citizen | 403 `Requires role: ADMIN` |

### External data — no defects
| Check | Result |
|---|---|
| `GET /api/external/overview` (authenticated) | 200 — keys `weather, earthquakes, gdacs, generatedAt` (the USGS block is keyed **`earthquakes`**). Each block carries `source / fetchedAt / stale / status`: weather = Open-Meteo, `ok`, Delhi 21.9 °C Clear sky (real fetch); earthquakes = USGS Earthquake Feeds, `ok`, data `[]` — an honest **zero** regional events, not fabricated data |
| GDACS behaviour | First call returned `status:"unavailable"`, `stale:false`, `data:null` (upstream hiccup, honestly reported, nothing fabricated); a call ~50 s later returned `ok` with 12 real feed items. Degradation + recovery both behave as designed (cache + stale/unavailable semantics) |
| `GET /api/external/overview` anonymous | 401 |
| `GET /api/external/geocode?q=Guwahati` | 200 — Open-Meteo Geocoding, Guwahati, Assam, India (26.1844, 91.7458) with provenance block |
| `GET geocode?q=G` (too short) | 400 validation error (min length 2) |
| `GET geocode` anonymous | 401 |

---

## Defects found and fixed

**None.** Every area above behaved per its routes, validators, services and OpenAPI contract; no wrong status codes, missing validations, broken filters, authorization holes or crashes were found, so no source edits, rebuild or restart were performed. The backend was left exactly as found — **RUNNING** on `:4000` (PID 2513, health 200 at the end of the audit).

## Status-code / validation / security observations

1. **Incident list is intentionally unscoped; SOS is owner-scoped.** `GET /api/incidents` returns all incidents to any authenticated user, with `?mine=true` for own-only (documented in OpenAPI; the backend test-suite itself queries it as a citizen). SOS, by contrast, hard-scopes citizens in the service. This asymmetry is by design (incidents are shared operational data; SOS requests are personal), but it is worth knowing the task brief's "citizen sees own" expectation only holds with `?mine=true`.
2. **Decline leaves the incident at ASSIGNED.** `POST /incidents/:id/decline` marks the assignment DECLINED (200) but the incident status stays ASSIGNED with no active unit until an admin re-assigns (re-assign from ASSIGNED is supported). Not a contract violation — OpenAPI promises no status change for decline — but a dispatcher watching only incident status would not see the decline; the assignment record and notifications carry it.
3. **Assign responds 201 with the assignment, not the incident.** Correct per OpenAPI ("201 Assignment"), but clients must GET the incident to see the ASSIGNED status change.
4. **`POST /api/notifications/read-all` is a POST, not PATCH** (per routes); `PATCH /:id/read` is the single-item form. The brief's "mark-all-read" maps to this POST endpoint.
5. **No dedicated SOS cancel endpoint** — cancellation is `PATCH /api/sos/:id/status` → `CANCELLED`, restricted to the owning citizen. Any client looking for `/cancel` will 404.
6. **CSRF posture verified live in both directions:** cookie mutations without `x-csrf-token` → 403; with the header → success; Bearer-authenticated mutations are exempt and succeed without it.
7. **Validation is uniformly Zod-shaped:** 400s return `{error:"Validation failed", details:[{path, message, …}]}` with field-level detail for incidents, SOS, shelters, register and geocode; capacity rules fire both at schema level (create) and service level (shrink-below-occupancy on PATCH).
8. **Session security verified end-to-end:** logout invalidates the pre-logout Bearer token via `tokenVersion` (401 "Session has been invalidated"), PENDING accounts cannot log in (403), duplicate registration is a clean 409, and wrong-password is a generic 401.

## Remaining issues

- **None blocking.** No defects were found in any exercised group.
- Environmental/transient only: GDACS was briefly `unavailable` on the first external call (upstream), recovering on the next call — the API's honest `unavailable`/`stale` reporting handled it as designed.
- Audit-created records (2 users, 3 incidents — one CLOSED, one ASSIGNED/declined, one IN_PROGRESS; 4 SOS; notifications) remain in the dev/seed database; they are clearly named `Audit …` and do not affect the seeded demo accounts. The responder unit River Rescue 12's readiness was restored to DEPLOYED after the availability tests.
- Not covered by this step (out of scope): Socket.IO realtime behaviour, frontend wiring, and Playwright E2E — covered by other audit steps.
