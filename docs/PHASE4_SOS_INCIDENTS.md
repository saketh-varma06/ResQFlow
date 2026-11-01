# Phase 4 — SOS & incident management system (complete)

## SOS (citizens)
- Categories: FLOOD, FIRE, LANDSLIDE, MEDICAL, TRAPPED, INFRASTRUCTURE, OTHER (`SOSCategory` enum, required at submission).
- The SOS form shares **browser geolocation after explicit permission** (button → `navigator.geolocation`); denial/unavailability falls back to a manual location with an on-screen explanation — coordinates are optional, never forced. Submission goes through a **confirmation dialog**, and the success panel shows the **unique request ID** (the record's cuid), its status and its priority explanation.
- Citizens track status + full **response history** (`SOSStatusHistory` — new model: every transition with actor and timestamp) on the SOS page and in My Requests, and can cancel their own request while it is SUBMITTED/ACKNOWLEDGED.
- No automatic contact with real emergency services anywhere; the SOS page states this and tells users to call 112 first.

## Unified status workflow — validated on the backend
`SUBMITTED → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED` (+`CANCELLED` for SOS) for BOTH incidents and SOS (`src/utils/workflow.ts`). Every status change, assignment, accept and complete goes through `assertTransition`; skips (e.g. SUBMITTED → RESOLVED) return 400 naming the allowed transitions. Old enum values (REPORTED/VERIFIED/NEW/TEAM_ASSIGNED) were migrated with CASE mappings in migration `sos_workflow_priority`; the migration was verified by deploying all migrations from scratch onto empty dev and test databases. (The pre-existing seeded dev database was recreated from migrations + seed rather than upgraded in place — it held only seed data.)

## Priority scoring — explainable, rule-based
`src/utils/priority.ts`: score 0–100 + level (CRITICAL ≥70, HIGH ≥50, MEDIUM ≥30, else LOW) from severity (incidents) or category base (SOS), a time-critical category bump, people affected (scaled, capped 20), injuries (+4 each, capped 20), trapped (+15), and waiting time (+1 per 15 min, capped 10). Every contribution is stored in `priorityReasons` and displayed next to the score in citizen, responder and admin views. **It is a dispatcher sorting aid — explicitly not a medically validated or officially approved triage algorithm**, and the UI says so where the score is explained.

## Audit
Status changes and assignments were already audited (AuditLog: `sos.status_change`, `sos.assign`, `incident.status_change`, `incident.assign`, plus history tables per record). The workflow test asserts audit rows exist for SOS assignment and status changes.

## Frontend — now wired to real APIs
Citizen: Dashboard (live counts, alerts strip, my SOS/reports), SOS, Report Incident, My Requests (tabs, detail dialogs with timeline + priority reasons + cancel), Alerts, Shelters (search/filter/live map), Notifications (mark read/read-all), Profile (save + password change). Responder: Command Centre (priority queue, SOS counts, availability switch, live map), Assigned Incidents (accept/decline/complete), SOS Inbox (acknowledge / assign to my unit / start / resolve, priority-sorted), Incident Details (validated transition buttons, notes, timeline, priority explanation), Response History. Admin: Incident Management (search/filters, assign unit, workflow-limited status select, delete). Still on labelled preview data: Admin Dashboard, Alert/Shelter/User/Responder Management, Analytics, Audit Logs pages (their APIs exist; wiring them is the remaining frontend work).

## Tests & live verification (all actually run)
- Backend **37/37**: 21 Phase 2 + 9 Phase 3 authz + 7 new `workflow.test.ts` — priority unit tests (CRITICAL case, LOW case, category base + waiting bonus, transition map) and the brief's exact end-to-end workflow: citizen submits SOS (TRAPPED, trapped, 1 injury, 4 people → score 57, HIGH, reasons include trapped) → skip rejected 400 → responder acknowledges → admin assigns → responder IN_PROGRESS → RESOLVED → citizen reads RESOLVED with history chain [SUBMITTED, ACKNOWLEDGED, ASSIGNED, IN_PROGRESS, RESOLVED] and ≥1 `sos.assign` + ≥3 `sos.status_change` audit rows; citizen self-cancel; incident skip rejected.
- The same workflow was then repeated **live through the frontend dev origin** (:5173 proxy) with the seeded accounts and produced identical results; all five key wired routes returned HTTP 200.
- Root build green (backend tsc + frontend tsc/Vite); frontend test 1/1.
