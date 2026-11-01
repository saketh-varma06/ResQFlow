import { useMemo, useState } from "react";
import { List, Map as MapIcon, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import MapView, { type MapMarker } from "@/components/MapView";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, titleCase, type ApiIncident, type ApiShelter, type ApiSos, type ExtOverview, type GeoPlace, type GeocodeResult } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

type SevKey = "critical" | "high" | "moderate" | "low" | "safe";
const sevOf = (s: string): SevKey => (s === "CRITICAL" ? "critical" : s === "HIGH" ? "high" : s === "MODERATE" ? "moderate" : "low");
const prioSev = (level: string): SevKey => (level === "CRITICAL" ? "critical" : level === "HIGH" ? "high" : level === "MEDIUM" ? "moderate" : "low");

interface Row { id: string; kind: "incident" | "sos" | "shelter" | "quake"; title: string; sub: string; status: string; sev: SevKey; lat?: number | null; lng?: number | null; priorityLevel?: string; priorityScore?: number }

export default function OperationsMap({ sosScopeNote }: { sosScopeNote: string }) {
  const incidents = useApi(() => api<ListEnvelope<ApiIncident>>("/api/incidents?limit=100"));
  const sos = useApi(() => api<ListEnvelope<ApiSos>>("/api/sos?limit=100"));
  const shelters = useApi(() => api<ListEnvelope<ApiShelter>>("/api/shelters?limit=100"));
  const external = useApi(() => api<Envelope<ExtOverview>>("/api/external/overview"));
  const [layers, setLayers] = useState({ incident: true, sos: true, shelter: true, quake: true });
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [placeMarker, setPlaceMarker] = useState<MapMarker | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<GeoPlace[] | null>(null);
  const [placeMsg, setPlaceMsg] = useState("");
  async function searchPlace() {
    if (placeQuery.trim().length < 2) { setPlaceMsg("Type at least 2 characters of a place name."); return; }
    setPlaceMsg("Searching…"); setPlaceResults(null);
    try {
      const r = await api<Envelope<GeocodeResult>>(`/api/external/geocode?q=${encodeURIComponent(placeQuery.trim())}`);
      if (r.data.status === "unavailable" || !r.data.data) { setPlaceMsg("Place search is unavailable right now (external service unreachable). You can still enter coordinates manually in the SOS and Report forms."); return; }
      setPlaceResults(r.data.data);
      setPlaceMsg(r.data.data.length === 0 ? "No places matched that search." : "");
    } catch (err) { setPlaceMsg(err instanceof ApiError ? err.message : "Place search failed."); }
  }
  function pickPlace(pl: GeoPlace) {
    setFocus({ lat: pl.latitude, lng: pl.longitude, zoom: 12 });
    setPlaceMarker({ id: "place", lat: pl.latitude, lng: pl.longitude, label: pl.name, detail: [pl.admin1, pl.country].filter(Boolean).join(", "), kind: "place", severity: "low" });
    setPlaceResults(null); setPlaceMsg("");
    setView("map");
  }
  const [sevFilter, setSevFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"map" | "list">("map");

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const i of incidents.data?.data ?? []) out.push({ id: `inc-${i.id}`, kind: "incident", title: i.title, sub: `${titleCase(i.type)} · ${i.location} · ${fmtDate(i.createdAt)}`, status: i.status, sev: sevOf(i.severity), lat: i.latitude, lng: i.longitude, priorityLevel: i.priorityLevel, priorityScore: i.priorityScore });
    for (const s of sos.data?.data ?? []) out.push({ id: `sos-${s.id}`, kind: "sos", title: s.need, sub: `SOS · ${titleCase(s.category)} · ${s.location} · ${fmtDate(s.createdAt)}`, status: s.status, sev: prioSev(s.priorityLevel), lat: s.latitude, lng: s.longitude, priorityLevel: s.priorityLevel, priorityScore: s.priorityScore });
    for (const s of shelters.data?.data ?? []) out.push({ id: `sh-${s.id}`, kind: "shelter", title: s.name, sub: `Shelter · ${s.address} · ${s.available ?? s.capacity - s.occupied} places free`, status: s.status, sev: s.status === "FULL" ? "critical" : s.status === "NEARLY_FULL" ? "moderate" : "safe", lat: s.latitude, lng: s.longitude });
    for (const q of external.data?.data.earthquakes.data ?? []) out.push({ id: `qk-${q.id}`, kind: "quake", title: `M${q.magnitude.toFixed(1)} earthquake`, sub: `USGS · ${q.place} · depth ${q.depthKm} km · ${fmtDate(q.time)}`, status: "EXTERNAL", sev: q.magnitude >= 6 ? "critical" : q.magnitude >= 5.5 ? "high" : q.magnitude >= 5 ? "moderate" : "low", lat: q.latitude, lng: q.longitude });
    return out;
  }, [incidents.data, sos.data, shelters.data, external.data]);

  const filtered = rows.filter((r) => layers[r.kind]
    && (sevFilter === "ALL" || r.sev === sevFilter.toLowerCase() || (sevFilter === "SAFE" && r.sev === "safe"))
    && (search.trim() === "" || `${r.title} ${r.sub}`.toLowerCase().includes(search.toLowerCase())));
  const markers: MapMarker[] = filtered.filter((r) => r.lat && r.lng).map((r) => ({
    id: r.id, lat: r.lat!, lng: r.lng!, label: r.title, kind: r.kind, severity: r.sev,
    lines: [r.sub, `Status: ${titleCase(r.status)}`, ...(r.priorityLevel ? [`Priority: ${r.priorityLevel} (${r.priorityScore})`] : [])],
  }));
  const loading = incidents.loading || sos.loading || shelters.loading;
  const loadError = incidents.error || sos.error || shelters.error;
  const noCoords = filtered.length - markers.length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Search incidents, SOS, shelters…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search map items" />
        </div>
        <Select aria-label="Filter by severity" className="w-44" value={sevFilter} onChange={(e) => setSevFilter(e.target.value)}>
          <option value="ALL">All severities</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MODERATE">Moderate</option><option value="LOW">Low</option><option value="SAFE">Safe / open</option>
        </Select>
        <div className="flex gap-1.5" role="group" aria-label="View mode">
          <Button size="sm" variant={view === "map" ? "default" : "outline"} onClick={() => setView("map")}><MapIcon className="mr-1.5 h-4 w-4" aria-hidden /> Map</Button>
          <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}><List className="mr-1.5 h-4 w-4" aria-hidden /> List</Button>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {(["incident", "sos", "shelter", "quake"] as const).map((k) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 font-medium">
            <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} className="h-4 w-4 accent-red-600" />
            {k === "incident" ? "Incidents" : k === "sos" ? "SOS" : k === "shelter" ? "Shelters" : "Earthquakes (USGS)"}
          </label>
        ))}
        <span className="text-muted-foreground">{sosScopeNote}</span>
      </div>
      <Card className="mb-4"><CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3 text-xs font-medium" aria-label="Map legend">
        <span className="font-bold uppercase tracking-wide text-muted-foreground">Legend</span>
        <span className="flex items-center gap-1.5"><span className="map-pin" style={{ background: "#dc2626", width: 18, height: 18, fontSize: 10 }}>!</span> Incident (critical)</span>
        <span className="flex items-center gap-1.5"><span className="map-pin" style={{ background: "#ea580c", width: 18, height: 18, fontSize: 10 }}>S</span> SOS (high priority)</span>
        <span className="flex items-center gap-1.5"><span className="map-pin" style={{ background: "#059669", width: 18, height: 18, fontSize: 10 }}>⌂</span> Shelter (open)</span>
        <span className="text-muted-foreground">Pin colour = severity / priority / shelter status: red critical · orange high · amber moderate · blue low · green safe/open. Click a pin for details.</span>
      </CardContent></Card>
      <Card className="mb-4"><CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-9" placeholder="Find a place by name (e.g. Guwahati)…" value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void searchPlace(); } }} aria-label="Search for a place" />
          </div>
          <Button size="sm" variant="outline" onClick={() => void searchPlace()}>Search place</Button>
          {placeMarker && <Button size="sm" variant="ghost" onClick={() => { setPlaceMarker(null); setFocus(null); }}>Clear marker</Button>}
        </div>
        {placeMsg && <p className="mt-2 text-xs text-muted-foreground" role="status">{placeMsg}</p>}
        {placeResults && placeResults.length > 0 && (
          <ul className="mt-2 divide-y rounded-lg border">
            {placeResults.map((pl) => (
              <li key={pl.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => pickPlace(pl)}>
                <span className="font-semibold">{pl.name}</span> <span className="text-muted-foreground">{[pl.admin1, pl.country].filter(Boolean).join(", ")} · {pl.latitude.toFixed(3)}, {pl.longitude.toFixed(3)}</span>
              </button></li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Place search: Open-Meteo Geocoding API (free, no key). Selecting a result centres the map — it does not share or store your location.</p>
      </CardContent></Card>
      {loading ? <LoadingCards count={2} /> : loadError ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{loadError}</p>
        : view === "map" ? (
          <Card><CardContent className="p-2">
            {markers.length || placeMarker ? <MapView markers={placeMarker ? [...markers, placeMarker] : markers} height={520} focus={focus} /> : <p className="p-4 text-sm text-muted-foreground">No mapped items match the current filters.</p>}
            {noCoords > 0 && <p className="px-2 pb-2 text-xs text-muted-foreground">{noCoords} matching record(s) have no coordinates and appear in List view only.</p>}
          </CardContent></Card>
        ) : (
          <Card><CardContent className="space-y-2 py-4">
            {filtered.length === 0 ? <EmptyState title="Nothing matches" description="Adjust the layers, severity filter or search." />
              : filtered.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                  <span className="font-semibold">{r.title}</span>
                  {r.priorityLevel && <PriorityBadge level={r.priorityLevel} score={r.priorityScore} />}
                  <span className="ml-auto"><StatusBadge status={r.status} /></span>
                  <span className="w-full text-xs text-muted-foreground">{r.sub}{r.lat && r.lng ? ` · ${r.lat}, ${r.lng}` : " · no coordinates"}</span>
                </div>))}
          </CardContent></Card>)}
      <p className="mt-3 text-xs text-muted-foreground">Map data © OpenStreetMap contributors — Leaflet + OpenStreetMap tiles, no API key required. Incident/SOS/shelter positions come from records in the ResQFlow backend.{external.data?.data.earthquakes ? ` Earthquake events: U.S. Geological Survey (USGS) external data, fetched ${fmtDate(external.data.data.earthquakes.fetchedAt)}${external.data.data.earthquakes.stale ? " (stale — refresh failed, showing last good copy)" : ""}.` : ""}</p>
    </div>
  );
}
