# ResQFlow — Advancement Report (Stages A–G)

**Date:** 2 Nov 2026 · **Basis:** deep research into Sahana Eden, SAMBRO/CAP, Ushahidi,
HOT Tasking Manager, CrisisCleanup, InaSAFE, PDC DisasterAWARE, SACHET/NDMA and ReliefWeb
(full research: `~/workspace/research_notes/disaster-platform-feature-research-20261102-1041/report.md`).
The existing project was built up in place — no rebuild, no wholesale changes. Every stage was
gated on: root build → new tests → live end-to-end run → commit.

## What was added

### Stage A — Trust layer (commit `6fc985b`)
- Verification states (UNVERIFIED / VERIFIED / FLAGGED_DUPLICATE) on incidents and SOS, kept
  separate from the lifecycle status, exactly as Ushahidi/Sahana separate moderation from workflow.
- Duplicate detection by deterministic rules only (distance ≤1.5/5 km, same area, text similarity,
  same reporter/phone, time window) with explainable match reasons; a human confirms the merge —
  never auto-merged. Reporters are notified when their report is merged.
- Claim-and-lock (CrisisCleanup pattern): a second unit assigning a claimed SOS gets HTTP 409
  naming the holder; explicit release returns it to the pool. Incidents gained claim/release too.
- Vulnerability flags (elderly, children, disability, medical dependence, pregnancy) feed the
  priority score (+5 each, capped +15) with the reason printed in the score breakdown.

### Stage B — Standards-based alerting (commit `222f679`)
- Alerts carry Common Alerting Protocol 1.2 fields (headline, category, urgency, certainty,
  centre + radius) — the standard SAMBRO and India's SACHET are built on.
- Public CAP XML per alert + a combined CAP Atom feed at `/api/alerts/cap.xml`
  (carries the academic-demonstration disclaimer).
- Citizen alert subscriptions by district or by radius with minimum severity; publish-time
  matching unions subscription matches with the legacy home-district rule, deduplicated.
- Web Push end-to-end: VAPID-signed pushes fan out from the notification service; the PWA
  service worker was rebuilt (injectManifest) to receive them; dead endpoints are pruned.

### Stage C — Road-time dispatch (commit `2b91ac6`)
- Responder units have base coordinates; dispatch ranks units by **real OSRM road time**
  (Table API), with the driving route drawn on the map (Route API GeoJSON).
  Live proof: River Rescue 12 → 2.6 min / 1.1 km vs Fire & Rescue 3 → 4.1 min / 3.0 km
  for a Chandni Chowk incident.
- Honest degradation: OSRM down → straight-line estimates, labelled as such in API and UI;
  units without coordinates are listed as unranked, never dropped silently.

### Stage D — Relief logistics (commit `de0aa02`)
- Shelters post itemised needs; any signed-in user can pledge, capped at the remaining amount
  (over-pledging refused with the exact remainder); FULFILLED flips automatically; delivery is
  staff-confirmed; cancellation reopens the need. Citizens see totals and only their own pledges.
- Minimum-needs calculator (InaSAFE/Sphere): water 15 L/person/day, 1 ration kit/person/day,
  blankets, household hygiene kits — assumptions stated in every response.

### Stage E — Field kit + duplicate-safe offline sync (commit `7e2f42d`)
- Per-category responder checklists, persisted server-side, writable only by the assigned unit
  or an admin (an unassigned SOS can be worked by any responder until claimed).
- Structured field reports (situation, people, injuries, needs, risks); the reporter is notified.
- Idempotent submission: every SOS/incident carries a `clientRequestId`; a retried offline sync
  returns the original record instead of duplicating it, enforced by a unique partial index.
  (The live run caught a sparse-compound-index build failure on existing data — replaced with a
  partial index and re-verified.)

### Stage F — SitRep, replay, more live layers (commit `8673923`)
- One-click Situation Report (RESPONDER/ADMIN) computed only from live records — caseload,
  24-hour flow, severity/type/area breakdown, shelter utilisation, top priorities — plus a
  paste-ready plain-text rendering.
- After-action replay (ADMIN): status history + audit log merged into one chronological stream
  with a play/scrub UI and map playback.
- External overview gains NASA EONET regional events and Open-Meteo Flood (GloFAS) river
  discharge watch points (Delhi/Yamuna + active alert centres) under the same
  provenance/cache/stale contract as the existing feeds.

### Stage G — Missing persons, privacy-first (commit `09bc425`)
- Family-tracing registry modelled on ICRC practice: **no public list exists**. Citizens see
  only their own reports; other citizens get 404 (existence is not disclosed). Staff get the
  searchable registry with reporter contact for reunification.
- Workflow REPORTED → SEARCHING → FOUND_ALIVE / FOUND_DECEASED / CLOSED; marking found
  requires a resolution note; the reporter is notified with a tone-appropriate message.

## What was deliberately NOT built (and why)
- **Volunteer registry** — duplicates the responder system.
- **Social-media monitoring** — research verdict: unreliable signal, misinformation-prone,
  poor geolocation, API-restricted.
- **AI auto-dispatch / auto-verification** — every serious platform keeps AI as
  human-confirmed suggestions only; duplicate suggestions here are deterministic + human-confirmed.
- **Live hospital beds / fleet GPS** — no public API exists; platforms showing these simulate them.
- **Official SMS / Cell Broadcast / direct IMD API** — telco/regulator-gated; ResQFlow consumes
  official alerts (CAP) but must never pretend to issue them.

## Verification (per stage)
| Stage | New tests | Live E2E | OpenAPI after |
|-------|-----------|----------|---------------|
| A | verification.test.ts 5/5 (full suite 62/62 at the time) | 10/10 | 50 paths |
| B | capalerts.test.ts 7/7 | 8/8 | 57 paths |
| C | dispatch.test.ts 4/4 | 6/6 vs real OSRM | 61 paths |
| D | relief.test.ts 6/6 | 6/6 | 67 paths |
| E | fieldkit.test.ts 6/6 | 4/4 | 73 paths |
| F | sitrep.test.ts 6/6 | 5/5 (EONET + GloFAS live) | 75 paths |
| G | missingpersons.test.ts 5/5 | 4/4 | 78 paths |

Full-suite regression result (final gate): **96/96 backend tests + 1/1 frontend**, root build clean, lint 0 errors — detail in `docs/TEST_REPORT.md`.
No Grok API key was needed at any point — every addition runs on keyless public feeds
(OSRM, NASA EONET, Open-Meteo/GloFAS) or on the platform's own data.
