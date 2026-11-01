# ResQFlow — API Integration Report

Date: 1 Nov 2026 · All integrations are keyless public APIs, called **from the backend**
(never directly from the browser), with timeouts, in-memory caching, single-flight
de-duplication, and per-source provenance. The frontend only ever talks to
`/api/external/*`, so the app keeps working (with honest stale/unavailable states)
when an upstream source is down.

## Integrations

| # | API | Endpoint used | Code location | Purpose | Auth | Status | Test result |
|---|---|---|---|---|---|---|---|
| 1 | Open-Meteo Forecast | `https://api.open-meteo.com/v1/forecast` (current: temperature, humidity, apparent temp, weather code, wind, precipitation; daily precipitation, 3 days) | `backend/src/services/external.service.ts` (`getWeather`) → `GET /api/external/overview` → `frontend/src/components/ExternalDataPanel.tsx` (citizen dashboard, responder command centre, admin dashboard) | Local weather + short precipitation outlook for situational awareness. **Never presented as an official warning.** | None (free, no key) | **Working** | Live-verified 1 Nov 2026: Delhi "Clear sky", 23.1 °C. Unit tests with stubbed fetch: 8/8 in `external.test.ts` |
| 2 | USGS Earthquake Feeds | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson` (M4.5+, past day), filtered to the regional box lat 5–40 / lon 65–100, max 10 | `external.service.ts` (`getEarthquakes`, `filterQuakes`) → overview → panel **and** the operations map "Earthquakes (USGS)" layer | Recent regional earthquake events with magnitude, place, time, depth, source link | None | **Working** | Live-verified: feed fetched successfully; **0 events inside the regional box** in the past day at test time — reported as zero. Parser unit tests pass |
| 3 | GDACS | `https://www.gdacs.org/xml/rss.xml` (RSS feed — the public no-key route; alert level parsed from the title, event type from the report link, India-related flag from text) | `external.service.ts` (`getGdacs`, `parseGdacsRss`) → overview → panel (labelled external data) | Global disaster events: floods, tropical cyclones, earthquakes, volcanoes, droughts with alert levels and source links | None | **Working** | Live-verified: 12 current items, 1 India-related (tropical cyclone). Parser unit tests pass |
| 4 | Open-Meteo Geocoding | `https://geocoding-api.open-meteo.com/v1/search?name=…&count=5&language=en&format=json` | `external.service.ts` (`geocodePlaces`) → `GET /api/external/geocode?q=…` → operations map place search | Find coordinates by place name when the user doesn't know them; selecting a result centres the map (nothing is stored or shared) | None | **Working** (added in this audit round) | Live-verified: "Guwahati" → 26.1844, 91.7458 (+ airport). Endpoint tests: auth required (401), result mapping with provenance, short-query rejection (400) |
| 5 | OpenStreetMap tiles | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` via Leaflet | `frontend/src/components/MapView.tsx`, `OperationsMap.tsx` | Base map for incidents/SOS/shelters/earthquakes; attribution shown; tile usage policy respected (standard tile layer, no bulk downloading; service worker caches viewed tiles only) | None | **Working** | Maps render in the built app; tiles load from OSM directly in the browser |

## Cross-cutting behaviour (all backend-proxied sources)

- **Timeout:** 9 s per fetch (AbortController).
- **Caching:** in-memory per source — weather 10 min, earthquakes 5 min, GDACS 15 min,
  geocoding 10 min per query; concurrent requests share one in-flight fetch.
- **Failure contract:** a failed refresh serves the last good copy flagged
  `stale: true` with the error; with a cold cache the source returns
  `status: "unavailable"`, `data: null`. **Data is never fabricated.**
- **Provenance:** every source block carries `source`, `sourceUrl`, `fetchedAt`,
  `stale`, `status`; the UI displays source + fetched time and stale/unavailable states.
- **Retry:** no automatic retry loops against upstreams (rate-limit friendly); the
  next user request after the TTL retries naturally.
- **Auth:** `/api/external/*` requires a logged-in user (the data is public, but the
  proxy is part of the app surface). Shelters/alerts public reads used by the landing
  page are separate first-party endpoints.
- **Secrets:** none of the integrations needs an API key; no credentials exist in
  frontend code.

## Not integrated (deliberately)

- GDACS *swagger API* — evaluated; the RSS feed is the accessible public route and
  covers the needed fields. No fake success was substituted.
- IMD / NDMA / any official Indian warning feed — no public keyless API available;
  the app therefore never claims to show official warnings.
- Any paid weather/geocoding provider — unnecessary; Open-Meteo covers both.
