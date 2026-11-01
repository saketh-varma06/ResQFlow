# Phase 5 — Geospatial, shelters & external data (complete)

## Map (Leaflet + OpenStreetMap, no API key)
- New operations map for all three roles (`/citizen/map`, `/responder/map`, `/admin/map`, shared `OperationsMap` component): live incident, SOS and shelter markers from the backend; pin symbol by kind (! incident, S = SOS, ⌂ shelter) and pin colour by severity/priority/status (red critical, orange high, amber moderate, low blue, green open/safe).
- Layer toggles per kind, severity filter, text search, **list/map view switching**, a legend card, and popups with status, priority and location lines. Records without coordinates are counted and shown in list view instead of being silently dropped. Citizens see only their own SOS pins (backend scoping); responders/admins see all.
- `MapView` was upgraded in place (kind-aware pins, multi-line popups) and is also used by shelters, command centre and incident details. Browser geolocation with manual fallback was already wired in Phase 4 (SOS + report forms) and is unchanged.
- Verification limit (stated honestly): pages build and serve (HTTP 200) and data endpoints return coordinates, but visual rendering of Leaflet tiles cannot be inspected from this environment (the browser tool cannot open loopback pages) — the same limitation recorded in Phase 1.

## Shelters — complete management
- Model/API now cover every requested field: name, address, **latitude/longitude**, total capacity, occupied, **available** (computed server-side as capacity − occupied and returned on every response), facilities, **accessibility details** (new `accessibility` column, migration `shelter_accessibility`), operational status (derived: FULL ≥100%, NEARLY_FULL ≥90%, CLOSED when set), and **last updated** (`updatedAt`, shown in both UIs).
- Validation: capacity ≥ 1 (Zod), occupied ≤ capacity enforced in the validator refine AND the service on both create and update (including shrinking capacity below current occupancy) → 400. Citizens search/filter shelters (name, address, area, with-space) read-only; create/edit/delete are admin-only (403 for citizens) — all covered by `shelters.test.ts` (5 tests).
- Admin Shelter Management page was fully wired (create/edit dialog with all fields, delete with confirm); the citizen Shelters page now shows available places from the API, accessibility details and last-updated time.

## External data — public, no-key sources only
New `GET /api/external/overview` (authenticated) backed by `external.service.ts`:
- **Open-Meteo** (no key, free non-commercial terms): current conditions + 3-day precipitation forecast for the platform area (Delhi defaults; `lat`/`lon` query params validated).
- **USGS Earthquake Feeds** (public domain): `4.5_day` GeoJSON, filtered to the regional bounding box (lat 5–40, lon 65–100), newest first, max 10.
- **GDACS RSS** (public domain, UN/EC): parsed items with alert level (from the title), event type (from the report link), published time and an India-related flag.
- **Provenance & honesty:** every source block returns `source`, `sourceUrl`, `fetchedAt`, `stale`, `status`. The UI (`ExternalDataPanel` on the citizen dashboard and responder command centre) labels the section "Live external data — public sources, not ResQFlow records" and shows the fetched time per source.
- **Caching & rate limits:** in-memory cache per source (weather 10 min, USGS 5 min, GDACS 15 min — matching feed cadences) with single-flight de-duplication of concurrent fetches; a 9 s timeout per fetch.
- **Downtime:** if a refresh fails, the last good copy is served with `stale: true` and the error shown; with no cache the source returns `status: "unavailable"`, `data: null` — **no data is ever fabricated**, and no credentials exist to invent (all three endpoints are keyless; that is why they were chosen).
- Verified live (1 Nov 2026): Open-Meteo returned real Delhi weather (23.7 °C, clear, humidity 70%), GDACS returned 12 current items (1 India-related — the North Indian Ocean cyclone), USGS returned 17 global events with 0 inside the regional box in the past day (reported as zero, not padded), and a second call returned the identical `fetchedAt` (cache hit).
- Tests: `external.test.ts` (5) — parser unit tests (USGS regional filter, GDACS RSS parse incl. alert level/type/India flag) and endpoint tests with a stubbed fetch: provenance fields, stale-on-outage after TTL expiry, cold-cache unavailable with null data, 401 unauthenticated.

## Test totals after Phase 5
Backend **47/47** (21 Phase 2 + 9 authz + 7 workflow + 5 external + 5 shelters). Root build green; frontend test 1/1.
