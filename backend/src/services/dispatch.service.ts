import { ApiError } from "../utils/ApiError";
import { IncidentModel, ResponderModel, SosRequestModel } from "../models";

/**
 * Nearest-unit dispatch ranking (Stage C), powered by the public OSRM demo server
 * (router.project-osrm.org — driving profile, no key, no SLA; fine for a demo,
 * a production deployment should self-host OSRM or use a keyed provider).
 *
 * Ranking is by real road time, not straight-line distance. If OSRM is unreachable
 * the service degrades to straight-line estimates and says so (`source` field) —
 * it never fabricates road times. Results are cached for 60 s per target.
 */

const OSRM_BASE = process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";
const FETCH_TIMEOUT_MS = 9000;
const cache = new Map<string, { at: number; value: DispatchResult }>();

export interface DispatchEntry {
  profileId: string;
  unitName: string;
  unitType: string;
  base: string;
  baseLat: number;
  baseLng: number;
  readiness: string;
  members: number;
  durationMinutes: number | null;
  distanceKm: number | null;
  straightLineKm: number;
}
export interface DispatchResult {
  target: { latitude: number; longitude: number };
  source: "osrm" | "straight-line-fallback";
  ranked: DispatchEntry[];
  unranked: { profileId: string; unitName: string; reason: string }[];
  generatedAt: string;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "ResQFlow/1.0 (academic disaster-response demo)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function rank(latitude: number, longitude: number): Promise<DispatchResult> {
  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;

  const units = await ResponderModel.find({ readiness: { $ne: "OFF_DUTY" } }).sort({ unitName: 1 });
  const withCoords = units.filter((u) => u.baseLat != null && u.baseLng != null);
  const unranked = units.filter((u) => u.baseLat == null || u.baseLng == null)
    .map((u) => ({ profileId: u.id, unitName: u.unitName, reason: "Unit has no base coordinates" }));

  const entries: DispatchEntry[] = withCoords.map((u) => ({
    profileId: u.id, unitName: u.unitName, unitType: u.unitType, base: u.base,
    baseLat: u.baseLat as number, baseLng: u.baseLng as number,
    readiness: u.readiness, members: u.members,
    durationMinutes: null, distanceKm: null,
    straightLineKm: Math.round(distanceKm(u.baseLat as number, u.baseLng as number, latitude, longitude) * 10) / 10,
  }));

  let source: DispatchResult["source"] = "straight-line-fallback";
  if (entries.length > 0) {
    try {
      const coords = [...entries.map((e) => `${e.baseLng},${e.baseLat}`), `${longitude},${latitude}`].join(";");
      const destIdx = entries.length;
      const url = `${OSRM_BASE}/table/v1/driving/${coords}?sources=${entries.map((_, i) => i).join(";")}&destinations=${destIdx}&annotations=duration,distance`;
      const json = (await fetchJson(url)) as { code?: string; durations?: (number | null)[][]; distances?: (number | null)[][] };
      if (json.code === "Ok" && Array.isArray(json.durations)) {
        entries.forEach((e, i) => {
          const dur = json.durations?.[i]?.[0];
          const dist = json.distances?.[i]?.[0];
          e.durationMinutes = dur != null ? Math.round((dur / 60) * 10) / 10 : null;
          e.distanceKm = dist != null ? Math.round((dist / 1000) * 10) / 10 : null;
        });
        source = "osrm";
      }
    } catch { /* fall through to straight-line estimates */ }
  }
  if (source === "osrm") entries.sort((a, b) => (a.durationMinutes ?? Infinity) - (b.durationMinutes ?? Infinity));
  else entries.sort((a, b) => a.straightLineKm - b.straightLineKm);

  const result: DispatchResult = { target: { latitude, longitude }, source, ranked: entries, unranked, generatedAt: new Date().toISOString() };
  cache.set(key, { at: Date.now(), value: result });
  return result;
}

export async function dispatchForIncident(id: string): Promise<DispatchResult> {
  const inc = await IncidentModel.findById(id);
  if (!inc) throw ApiError.notFound("Incident not found");
  if (inc.latitude == null || inc.longitude == null) throw ApiError.badRequest("This incident has no coordinates, so road-time ranking is not possible. Add coordinates to the report first.");
  return rank(inc.latitude, inc.longitude);
}

export async function dispatchForSos(id: string): Promise<DispatchResult> {
  const sos = await SosRequestModel.findById(id);
  if (!sos) throw ApiError.notFound("SOS request not found");
  if (sos.latitude == null || sos.longitude == null) throw ApiError.badRequest("This SOS has no coordinates, so road-time ranking is not possible. The citizen did not share a location pin.");
  return rank(sos.latitude, sos.longitude);
}

export interface RouteResult {
  profileId: string;
  unitName: string;
  durationMinutes: number;
  distanceKm: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  source: "osrm";
}

/** Driving route from one unit's base to the target, for drawing on the map. */
export async function routeFor(kind: "INCIDENT" | "SOS", id: string, profileId: string): Promise<RouteResult> {
  const target = kind === "INCIDENT" ? await IncidentModel.findById(id) : await SosRequestModel.findById(id);
  if (!target) throw ApiError.notFound(kind === "INCIDENT" ? "Incident not found" : "SOS request not found");
  if (target.latitude == null || target.longitude == null) throw ApiError.badRequest("This report has no coordinates to route to");
  const unit = await ResponderModel.findById(profileId);
  if (!unit) throw ApiError.notFound("Responder unit not found");
  if (unit.baseLat == null || unit.baseLng == null) throw ApiError.badRequest("This unit has no base coordinates");
  const url = `${OSRM_BASE}/route/v1/driving/${unit.baseLng},${unit.baseLat};${target.longitude},${target.latitude}?overview=full&geometries=geojson`;
  const json = (await fetchJson(url).catch(() => null)) as { code?: string; routes?: { duration: number; distance: number; geometry: RouteResult["geometry"] }[] } | null;
  const route = json?.code === "Ok" ? json.routes?.[0] : undefined;
  if (!route) throw ApiError.badRequest("Routing service could not compute a route for this unit");
  return { profileId: unit.id, unitName: unit.unitName, durationMinutes: Math.round((route.duration / 60) * 10) / 10, distanceKm: Math.round((route.distance / 1000) * 10) / 10, geometry: route.geometry, source: "osrm" };
}
