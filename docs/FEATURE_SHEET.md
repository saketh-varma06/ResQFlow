# ResQFlow — Complete Feature Sheet

**What it is:** a disaster management & emergency response platform with three role-based
workspaces (citizen, responder, admin), a real cloud database (MongoDB Atlas), realtime
updates, and a relief-logistics + family-tracing layer. Built phase by phase (0–6), migrated
from PostgreSQL/Prisma to MongoDB Atlas with a verified zero-diff cutover, then extended by a
research-led advancement programme (Stages A–G) modelled on Sahana Eden, SAMBRO, Ushahidi,
CrisisCleanup, HOT Tasking Manager, InaSAFE and ICRC family-tracing practice.

**Stack:** React 19 + TypeScript + Vite + Tailwind + shadcn/ui · Express 5 + TypeScript ·
Mongoose/MongoDB Atlas · Socket.IO · JWT + httpOnly cookies · Leaflet/OpenStreetMap ·
OSRM routing · vite-plugin-pwa · OpenAPI 3.0.3 (81 paths).

---

## 1. Accounts, security, access control
- Register / login / logout for citizens, responders, admins.
- Sessions: httpOnly SameSite cookie **and** Bearer token; server-side session invalidation
  via `tokenVersion` — logout or password change kills existing sessions **and** live sockets.
- CSRF double-submit protection on cookie-authenticated mutations; login rate limiting.
- Elevated roles (responder/admin) register as PENDING and cannot log in until an admin
  activates them — nobody self-promotes.
- RBAC enforced on the **backend** on every route (the UI hiding a button is never the control).
- Full audit log of consequential actions (who, what, when), searchable by actor.

## 2. Citizen workspace
- SOS form: category, people, injuries, trapped flag, vulnerability flags, browser
  geolocation with manual fallback, confirmation step, unique ID on success.
- Incident reporting with the same fields; both work **offline** (queued, clearly labelled
  "not yet received by the server", auto-sent on reconnect — and duplicate-proof, §9).
- Live tracking of own SOS/incidents with the full status history.
- Shelter finder: real capacity/occupancy, free places, accessibility notes, map, search.
- Disaster alerts inbox + **alert subscriptions** (by district or by radius, minimum
  severity) and **Web Push** notifications.
- Relief needs & pledging (§7), missing-person reports (§8), notifications centre,
  external hazard panel (weather, quakes, GDACS, EONET, river discharge).

## 3. Responder workspace (dark command theme)
- Command centre with live queues and the external-data panel.
- SOS inbox with priority scores (with the *reasons* printed), verification panel (§5),
  claim/release, nearest-units panel (§6), field kit (§9).
- Incident details: workflow controls limited to legal transitions, assignment management,
  notes, operations map with dispatch route drawn on it.
- Response history, operations map with layer toggles and place search.

## 4. Workflow & priority engine
- One validated lifecycle for incidents and SOS:
  SUBMITTED → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED (+ CANCELLED for SOS).
  Illegal jumps are refused server-side with the allowed transitions named.
- Explainable priority score 0–100 (severity/category base, people, injuries, trapped,
  vulnerability flags, waiting time) — every point has a printed reason. It is documented as
  a dispatcher sorting aid, **not** validated medical triage.

## 5. Trust layer (Stage A)
- Verification state (UNVERIFIED / VERIFIED / FLAGGED_DUPLICATE) tracked **separately** from
  lifecycle status — the Ushahidi/Sahana moderation pattern.
- Duplicate detection by deterministic rules (≤1.5/5 km distance, same area, text
  similarity, same reporter/phone, time window) producing scored candidates with match
  reasons. A human confirms the merge; nothing is auto-merged; the reporter is notified.
- Claim-and-lock: assigning a claimed SOS returns **409 naming the holding unit**; release
  returns it to the pool (CrisisCleanup pattern). Incidents have claim/release too.

## 6. Dispatch (Stage C)
- Units carry base coordinates; dispatch ranks by **real OSRM road time and distance**
  (not straight-line), fastest first, with readiness and unit size shown.
- Driving route (GeoJSON) drawn on the incident map; per-SOS nearest-units panel.
- Honest degradation: routing service down → straight-line estimates **labelled as such**;
  units without coordinates are listed as unranked, never silently dropped.

## 7. Relief logistics (Stage D)
- Shelters post itemised needs (item, category, quantity, unit).
- Any signed-in user can pledge — capped at the remaining amount (over-pledging refused
  with the exact remainder). FULFILLED flips automatically; delivery is staff-confirmed;
  cancellations reopen the need. Citizens see totals and only their own pledges.
- **Minimum-needs calculator** (Sphere/InaSAFE): from live occupancy — 15 L water and
  1 ration kit per person per day, blankets, household hygiene kits — with the standards
  and assumptions printed in the result.

## 7b. Monetary donations (Stage H)
- Donate to the **General Relief Fund**, a **specific shelter**, or a **specific incident**.
- Honest payment design: ResQFlow does **not** process payments (no gateway account) — the
  donor contributes by UPI/bank transfer outside the app and records it here with the
  transaction reference. The donation starts as **PLEDGED** and only becomes **RECEIVED**
  when a responder/admin verifies the reference at the Donations desk.
- **Public transparency ledger:** only verified RECEIVED donations count in the totals;
  donors can give anonymously (name masked publicly); donors are notified on verification;
  pledges can be cancelled by the donor. Donation totals also appear in the SitRep.

## 8. Missing persons (Stage G) — privacy-first, ICRC-style
- Any signed-in user files a report (last seen, description, circumstances, contact).
- **There is no public list.** Citizens see only their own reports; another citizen asking
  for a report gets **404** — the app does not even confirm it exists.
- Staff get a searchable tracing registry with reporter contact for reunification.
- Workflow REPORTED → SEARCHING → FOUND_ALIVE / FOUND_DECEASED / CLOSED; marking found
  **requires** a resolution note; the reporter is notified with a tone-appropriate message.

## 9. Field kit & offline integrity (Stage E)
- Per-category responder checklists (flood, fire, medical, trapped, landslide, storm,
  infrastructure + default), persisted server-side, editable only by the assigned unit
  or an admin (any responder may work an *unassigned* SOS until it is claimed).
- Structured field reports: situation, people on scene, injuries, needs, risks; the
  citizen who filed the report is notified.
- **Idempotent sync:** every SOS/incident submission carries a client-generated ID;
  a retried offline submission returns the original record instead of duplicating it,
  enforced by a unique partial index in MongoDB.

## 10. Alerting standard (Stage B)
- Alerts carry **CAP 1.2** fields (headline, category, urgency, certainty, centre+radius) —
  the standard used by SAMBRO and India's SACHET.
- Public CAP XML per alert + combined CAP Atom feed at `/api/alerts/cap.xml`.
- Delivery by publication matching: home-district rule ∪ subscriptions, deduplicated;
  the recorded `reach` is the true matched count.
- Web Push (VAPID) fanned out from the same notification service that drives in-app
  notifications and realtime toasts; dead push endpoints are pruned automatically.

## 11. Realtime & PWA (Phase 6)
- Socket.IO with **authenticated** handshakes; events scoped by role and ownership (a
  citizen never receives another citizen's events); SOS acknowledgement has its own wording.
- PWA: installable, precached app shell, offline outbox, network-first data for
  shelters/alerts, custom service worker that also receives push notifications.

## 12. Command analytics (Phase 6 + Stage F)
- Analytics from live records only: 14-day trends, pending-SOS age, average acknowledgement
  and resolution times, shelter utilisation, responder workload.
- **One-click Situation Report** in CARE/OCHA structure (overview, caseload, top
  priorities, shelters, alerts) as JSON or paste-ready plain text.
- **After-action replay:** status history + audit log merged into one chronological
  stream; play/scrub through an incident's life on the map (admin).

## 13. Live external data — with provenance, never fabricated
Weather (Open-Meteo) · Earthquakes (USGS) · Disaster alerts (GDACS RSS) ·
Natural events (NASA EONET) · River discharge / flood watch (Open-Meteo Flood, GloFAS) ·
Place geocoding (Open-Meteo). Every block carries source, source URL, fetch time and a
status; when a source is down the panel shows the last good copy flagged *stale*, or
*unavailable* with **no data** — it never invents numbers. All feeds are keyless.

## 14. Maps
Shared operations map for all roles: incident/SOS/shelter pins coloured by severity,
layer toggles, severity filter, search, earthquake layer, place search with focus,
records without coordinates counted and listed (not silently lost), dispatch route overlay.

---

## How this differs from other projects

| Capability | Typical academic / clone projects | Big real platforms | **ResQFlow** |
|---|---|---|---|
| Data | Hardcoded / mock JSON shown as real | Real, at national scale | **Real cloud DB; zero mock data in the app** (demo seed is labelled; the preview-data file was deleted and audited) |
| Verification of reports | None — every report is "true" | Ushahidi/Sahana moderate before trust | **Verification state machine + human-confirmed duplicate merging with scored reasons** |
| Double-dispatch | Two units can take the same case | CrisisCleanup claims remove work from the pool | **Claim-and-lock with 409 + release, on SOS and incidents** |
| Dispatch choice | Nearest by straight line, or manual list | PDC/HOT use road networks & tasking grids | **Ranked by real road time (OSRM) with the route drawn; fallback honestly labelled** |
| Alerting standard | Custom JSON only | SACHET/SAMBRO issue CAP | **CAP 1.2 export + feed** (consumes the standard correctly; never pretends to *be* an official issuer) |
| Alert targeting | Broadcast to everyone | Geo-targeted cell broadcast (telco-only) | **District + radius subscriptions, severity floor, deduplicated reach** |
| Offline behaviour | Breaks, or queues and duplicates | FieldTM/HOT design for field conditions | **Offline outbox with idempotency keys — retries can't duplicate a report** |
| Relief supply | Shelter = a pin with a capacity number | Sahana matches requests ↔ pledges | **Itemised needs, capped pledges, staff-confirmed delivery, Sphere minimum-needs math** |
| Money donations | A fake "Pay now" button or nothing | Real NGOs use payment gateways + audited accounts | **Donation ledger with human verification: pledged ≠ received, public totals count only verified money, anonymous giving supported** |
| Missing persons | A public list of names (privacy hazard) | ICRC: tracing, not publishing | **No public list; existence non-disclosure (404); staff-only registry** |
| Situation reports | Manual / absent | OCHA SitReps written by staff | **One-click SitRep generated only from live counts + after-action replay** |
| External data | Static screenshots or fake "live" widgets | DisasterAWARE fuses many feeds (closed) | **5 live keyless feeds with source, timestamp, stale/unavailable honesty** |
| AI claims | "AI-powered" auto-decisions | HOT fAIr: AI suggests, humans validate | **No fake AI: suggestions are deterministic + human-confirmed; priority is an explainable rule score** |
| Security depth | Login page + hidden buttons | Full IAM | **Cookie sessions with server-side invalidation, CSRF double-submit, pending-approval roles, backend RBAC, full audit log** |
| Proof of quality | Screenshots | Operational history | **96 backend tests + 1 frontend, per-feature live end-to-end runs, response-parity-verified DB migration, OpenAPI for all 78 paths** |

**Stated limits (kept honest):** it is an academic demonstration — it is *not* connected to
any official emergency service and says so on the landing page (call 112). It does not issue
official alerts, send SMS/cell broadcast, or show hospital beds/fleet GPS, because no public
API exists for those and platforms displaying them simulate the data. The OSRM demo server
has no SLA; a production deployment should self-host routing.

## Verification numbers (2 Nov 2026)
- Backend tests **100/100** across 14 files · frontend **1/1** · root build 0 TS errors · lint 0 errors.
- Per-stage live E2E on the real Atlas DB: A 10/10 · B 8/8 · C 6/6 · D 6/6 · E 4/4 · F 5/5 · G 4/4 · H (donations) 5/5.
- Earlier: 112-check backend audit (0 defects) · 24/24 cutover E2E · 32-endpoint parity diff
  vs the PostgreSQL build (identical) · socket scoping smoke 5/5.
- OpenAPI: **81 paths**, served at `/api/docs`.
