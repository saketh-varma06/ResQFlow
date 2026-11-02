/**
 * External public data sources — all no-key, publicly accessible endpoints:
 *  - Open-Meteo forecast API (https://open-meteo.com) — free for non-commercial use, no key.
 *  - USGS Earthquake Feeds (https://earthquake.usgs.gov) — public domain GeoJSON feeds.
 *  - GDACS RSS (https://www.gdacs.org) — public domain disaster alert feed (UN/EC service).
 *
 * Every result carries its source, the source URL, and the exact fetchedAt time so the UI can
 * show provenance. Results are cached in memory (respecting each feed's update cadence) and
 * concurrent requests share one in-flight fetch. If a source is down, the last good cached
 * copy is returned marked `stale: true`; with no cache, the source reports
 * `status: "unavailable"` with data: null — this service never fabricates data.
 */
export interface SourceResult<T> {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  stale: boolean;
  status: "ok" | "unavailable";
  error?: string;
  data: T | null;
}
export interface WeatherData {
  latitude: number; longitude: number; timezone: string;
  temperatureC: number; humidityPct: number; precipitationMm: number; rainMm: number;
  weatherCode: number; condition: string; windKph: number; windGustsKph: number;
  forecast: { date: string; precipitationMm: number; precipitationProbabilityPct: number | null }[];
}
export interface Quake { id: string; magnitude: number; place: string; time: string; depthKm: number; latitude: number; longitude: number; tsunami: boolean; url: string }
export interface GdacsItem { title: string; description: string; link: string; publishedAt: string; alertLevel: "RED" | "ORANGE" | "GREEN" | "UNKNOWN"; eventType: string; indiaRelated: boolean }

const TTL = { weather: 10 * 60_000, quakes: 5 * 60_000, gdacs: 15 * 60_000 };
const cache = new Map<string, { at: number; result: SourceResult<unknown> }>();
const inflight = new Map<string, Promise<SourceResult<unknown>>>();
export function resetExternalCache() { cache.clear(); inflight.clear(); }

const WMO: Record<number, string> = { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain", 71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail" };

async function fetchText(url: string, timeoutMs = 9000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "ResQFlow/1.0 (local development; public feed reader)", Accept: "application/json, application/rss+xml, text/xml, */*" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

async function cached<T>(key: string, ttl: number, source: string, sourceUrl: string, loader: () => Promise<T>): Promise<SourceResult<T>> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.result as SourceResult<T>;
  if (inflight.has(key)) return inflight.get(key) as Promise<SourceResult<T>>;
  const promise = (async (): Promise<SourceResult<T>> => {
    try {
      const data = await loader();
      const result: SourceResult<T> = { source, sourceUrl, fetchedAt: new Date().toISOString(), stale: false, status: "ok", data };
      cache.set(key, { at: Date.now(), result: result as SourceResult<unknown> });
      return result;
    } catch (err) {
      const old = cache.get(key);
      if (old) return { ...(old.result as SourceResult<T>), stale: true, error: err instanceof Error ? err.message : "fetch failed" };
      return { source, sourceUrl, fetchedAt: new Date().toISOString(), stale: false, status: "unavailable", error: err instanceof Error ? err.message : "fetch failed", data: null };
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, promise as Promise<SourceResult<unknown>>);
  return promise;
}

export async function getWeather(lat = 28.63, lon = 77.21): Promise<SourceResult<WeatherData>> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m&daily=precipitation_sum,precipitation_probability_max&forecast_days=3&timezone=auto`;
  return cached(`weather:${lat},${lon}`, TTL.weather, "Open-Meteo", "https://open-meteo.com", async () => {
    const json = JSON.parse(await fetchText(url)) as {
      latitude: number; longitude: number; timezone: string;
      current: { temperature_2m: number; relative_humidity_2m: number; precipitation: number; rain: number; weather_code: number; wind_speed_10m: number; wind_gusts_10m: number };
      daily: { time: string[]; precipitation_sum: number[]; precipitation_probability_max: (number | null)[] };
    };
    return {
      latitude: json.latitude, longitude: json.longitude, timezone: json.timezone,
      temperatureC: json.current.temperature_2m, humidityPct: json.current.relative_humidity_2m,
      precipitationMm: json.current.precipitation, rainMm: json.current.rain,
      weatherCode: json.current.weather_code, condition: WMO[json.current.weather_code] ?? `Weather code ${json.current.weather_code}`,
      windKph: json.current.wind_speed_10m, windGustsKph: json.current.wind_gusts_10m,
      forecast: json.daily.time.map((date, i) => ({ date, precipitationMm: json.daily.precipitation_sum[i] ?? 0, precipitationProbabilityPct: json.daily.precipitation_probability_max?.[i] ?? null })),
    };
  });
}

interface UsgsFeature { id: string; properties: { mag: number; place: string; time: number; tsunami: number; url: string }; geometry: { coordinates: [number, number, number] } }
export function filterQuakes(features: UsgsFeature[]): Quake[] {
  return features
    .filter((f) => { const [lon, lat] = f.geometry.coordinates; return lat >= 5 && lat <= 40 && lon >= 65 && lon <= 100; })
    .sort((a, b) => b.properties.time - a.properties.time)
    .slice(0, 10)
    .map((f) => ({ id: f.id, magnitude: f.properties.mag, place: f.properties.place, time: new Date(f.properties.time).toISOString(), depthKm: f.geometry.coordinates[2], longitude: f.geometry.coordinates[0], latitude: f.geometry.coordinates[1], tsunami: f.properties.tsunami === 1, url: f.properties.url }));
}
export async function getEarthquakes(): Promise<SourceResult<Quake[]>> {
  const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";
  return cached("quakes", TTL.quakes, "USGS Earthquake Feeds", url, async () => {
    const json = JSON.parse(await fetchText(url)) as { features: UsgsFeature[] };
    return filterQuakes(json.features);
  });
}

function xmlField(block: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(block);
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
}
export function parseGdacsRss(xml: string): GdacsItem[] {
  const items: GdacsItem[] = [];
  const blocks = xml.split(/<item>/).slice(1);
  for (const block of blocks) {
    const title = xmlField(block, "title");
    const description = xmlField(block, "description");
    const link = xmlField(block, "link");
    const pubDate = xmlField(block, "pubDate");
    if (!title || !link) continue;
    const levelMatch = /\b(Red|Orange|Green)\b/i.exec(title);
    const alertLevel = (levelMatch ? levelMatch[1].toUpperCase() : "UNKNOWN") as GdacsItem["alertLevel"];
    const typeMatch = /eventtype=([A-Z]+)/i.exec(link);
    items.push({
      title, description, link,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      alertLevel, eventType: typeMatch ? typeMatch[1].toUpperCase() : "OTHER",
      indiaRelated: /india/i.test(`${title} ${description}`),
    });
    if (items.length >= 12) break;
  }
  return items;
}
export async function getGdacs(): Promise<SourceResult<GdacsItem[]>> {
  const url = "https://www.gdacs.org/xml/rss.xml";
  return cached("gdacs", TTL.gdacs, "GDACS (UN/EC Global Disaster Alert and Coordination System)", url, async () => parseGdacsRss(await fetchText(url)));
}

export interface GeoPlace { id: number; name: string; admin1?: string; country?: string; latitude: number; longitude: number; population?: number }
interface GeocodingResponse { results?: { id: number; name: string; admin1?: string; country?: string; latitude: number; longitude: number; population?: number }[] }
/**
 * Place search via the Open-Meteo Geocoding API (keyless). Used when a user
 * knows a place name but not coordinates. Cached 10 min per query; failures
 * follow the same stale/unavailable contract as the other sources.
 */
export async function geocodePlaces(query: string): Promise<SourceResult<GeoPlace[]>> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  return cached(`geocode:${query.toLowerCase()}`, 10 * 60_000, "Open-Meteo Geocoding API", "https://geocoding-api.open-meteo.com/v1/search", async () => {
    const json = JSON.parse(await fetchText(url)) as GeocodingResponse;
    return (json.results ?? []).map((r) => ({ id: r.id, name: r.name, admin1: r.admin1, country: r.country, latitude: r.latitude, longitude: r.longitude, population: r.population }));
  });
}

export async function getExternalOverview(lat?: number, lon?: number) {
  const [weather, earthquakes, gdacs, eonet, flood] = await Promise.all([getWeather(lat, lon), getEarthquakes(), getGdacs(), getEonet(), getFloodWatch()]);
  return { weather, earthquakes, gdacs, eonet, flood, generatedAt: new Date().toISOString() };
}

export interface EonetEvent { id: string; title: string; categories: string[]; latitude: number; longitude: number; date: string; link: string }
interface EonetRaw { events?: { id: string; title: string; link: string; categories?: { title: string }[]; geometry?: { date: string; coordinates: [number, number] }[] }[] }
const IN_BBOX = (lat: number, lon: number) => lat >= 5 && lat <= 40 && lon >= 65 && lon <= 100;
export function filterEonet(raw: EonetRaw): EonetEvent[] {
  const out: EonetEvent[] = [];
  for (const e of raw.events ?? []) {
    const g = e.geometry?.[e.geometry.length - 1];
    if (!g) continue;
    const [lon, lat] = g.coordinates;
    if (!IN_BBOX(lat, lon)) continue;
    out.push({ id: e.id, title: e.title, categories: (e.categories ?? []).map((c) => c.title), latitude: lat, longitude: lon, date: g.date, link: e.link });
    if (out.length >= 10) break;
  }
  return out;
}
export async function getEonet(): Promise<SourceResult<EonetEvent[]>> {
  const url = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100&days=30";
  return cached("eonet", 15 * 60_000, "NASA EONET", url, async () => filterEonet(JSON.parse(await fetchText(url)) as EonetRaw));
}

export interface FloodWatch { name: string; latitude: number; longitude: number; dischargeToday: number; maxDischarge7d: number; trend: "rising" | "falling" | "steady"; unit: string }
interface FloodRaw { daily?: { time: string[]; river_discharge: (number | null)[] } }
export async function floodWatchPoint(name: string, lat: number, lon: number): Promise<FloodWatch> {
  const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge&forecast_days=7`;
  const raw = JSON.parse(await fetchText(url)) as FloodRaw;
  const series = (raw.daily?.river_discharge ?? []).filter((v): v is number => typeof v === "number");
  if (series.length === 0) throw new Error("no discharge data");
  const today = series[0];
  const max = Math.max(...series);
  const last = series[series.length - 1];
  return { name, latitude: lat, longitude: lon, dischargeToday: Math.round(today), maxDischarge7d: Math.round(max), trend: last > today * 1.05 ? "rising" : last < today * 0.95 ? "falling" : "steady", unit: "m³/s" };
}
export async function getFloodWatch(): Promise<SourceResult<FloodWatch[]>> {
  const sourceUrl = "https://flood-api.open-meteo.com/v1/flood (GloFAS river discharge)";
  return cached("flood", 30 * 60_000, "Open-Meteo Flood (GloFAS)", sourceUrl, async () => {
    // Watch points: Delhi (Yamuna) by default, plus centres of active alerts when they have one.
    const { AlertModel } = await import("../models");
    const alerts = await AlertModel.find({ status: "ACTIVE", centerLat: { $ne: null } }).sort({ publishedAt: -1 }).limit(2);
    const points: { name: string; lat: number; lon: number }[] = [{ name: "Delhi (Yamuna)", lat: 28.61, lon: 77.21 },
      ...alerts.filter((a) => a.centerLat != null && a.centerLng != null).map((a) => ({ name: a.area, lat: a.centerLat as number, lon: a.centerLng as number }))];
    const results: FloodWatch[] = [];
    for (const p of points) { try { results.push(await floodWatchPoint(p.name, p.lat, p.lon)); } catch { /* one failing point must not sink the layer */ } }
    if (results.length === 0) throw new Error("all flood watch points failed");
    return results;
  });
}
