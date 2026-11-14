import { useMemo, useState } from "react";
import { BedDouble, Crosshair, MapPin, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import MapView from "@/components/MapView";
import { ShelterNeedsPanel } from "@/components/ShelterNeedsPanel";
import { Button } from "@/components/ui/button";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, type ApiShelter, type GeoPlace, type GeocodeResult } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface RefPoint { lat: number; lon: number; label: string }

export default function SheltersPage() {
  const shelters = useApi(() => api<ListEnvelope<ApiShelter>>("/api/shelters?limit=100"));
  const [search, setSearch] = useState("");
  const [onlySpace, setOnlySpace] = useState(false);
  const [needsOpen, setNeedsOpen] = useState<string | null>(null);
  const [refPoint, setRefPoint] = useState<RefPoint | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<GeoPlace[] | null>(null);
  const [locMsg, setLocMsg] = useState("");
  async function searchPlace() {
    if (placeQuery.trim().length < 2) { setLocMsg("Type at least 2 characters of a place name."); return; }
    setLocMsg("Searching…"); setPlaceResults(null);
    try {
      const r = await api<Envelope<GeocodeResult>>(`/api/external/geocode?q=${encodeURIComponent(placeQuery.trim())}`);
      if (r.data.status === "unavailable" || !r.data.data) { setLocMsg("Place search is unavailable right now (external service unreachable)."); return; }
      setPlaceResults(r.data.data);
      setLocMsg(r.data.data.length === 0 ? "No places matched that search." : "");
    } catch (err) { setLocMsg(err instanceof ApiError ? err.message : "Place search failed."); }
  }
  function enableLocation() {
    if (!("geolocation" in navigator)) { setLocMsg("This browser does not support location."); return; }
    setLocMsg("Asking your browser for your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setRefPoint({ lat: Math.round(pos.coords.latitude * 10000) / 10000, lon: Math.round(pos.coords.longitude * 10000) / 10000, label: "Your location" }); setLocMsg(""); },
      () => { setLocMsg("Location was not shared. You can search for a place instead — nothing is stored either way."); },
      { timeout: 10000 },
    );
  }
  const rows = useMemo(() => {
    const filtered = (shelters.data?.data ?? []).filter((s) =>
      (!onlySpace || s.occupied < s.capacity) &&
      (search.trim() === "" || `${s.name} ${s.address} ${s.area}`.toLowerCase().includes(search.toLowerCase())));
    const withDist = filtered.map((s) => ({ s, distKm: refPoint && s.latitude && s.longitude ? haversineKm(refPoint.lat, refPoint.lon, s.latitude, s.longitude) : null }));
    if (refPoint) withDist.sort((a, b) => (a.distKm ?? Number.POSITIVE_INFINITY) - (b.distKm ?? Number.POSITIVE_INFINITY));
    return withDist;
  }, [shelters.data, search, onlySpace, refPoint]);
  const markers = rows.filter(({ s }) => s.latitude && s.longitude).map(({ s }) => ({ id: s.id, lat: s.latitude!, lng: s.longitude!, label: s.name, severity: (s.status === "FULL" ? "critical" : s.status === "NEARLY_FULL" ? "moderate" : "safe") as "critical" | "moderate" | "safe" }));
  return (
    <div>
      <PageHeader title="Find shelters" description="Live shelter list from the backend, with real capacity and occupancy." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Search by name, address or district…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search shelters" /></div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={onlySpace} onChange={(e) => setOnlySpace(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Only shelters with space</label>
      </div>
      <Card className="mb-4"><CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Nearest to:</span>
          {refPoint
            ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">{refPoint.label} ({refPoint.lat}, {refPoint.lon}) — sorted nearest first</span>
            : <span className="text-xs text-muted-foreground">Set a place or enable location to sort shelters by real distance.</span>}
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-9" placeholder="Find shelters near a place (e.g. Guwahati)…" value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void searchPlace(); } }} aria-label="Search for a place to find nearby shelters" />
          </div>
          <Button size="sm" variant="outline" onClick={() => void searchPlace()}>Search place</Button>
          <Button size="sm" variant="outline" onClick={enableLocation}><Crosshair className="mr-1.5 h-4 w-4" aria-hidden /> Enable location</Button>
          {refPoint && <Button size="sm" variant="ghost" onClick={() => setRefPoint(null)}>Clear</Button>}
        </div>
        {locMsg && <p className="mt-2 text-xs text-muted-foreground" role="status">{locMsg}</p>}
        {placeResults && placeResults.length > 0 && (
          <ul className="mt-2 divide-y rounded-lg border">
            {placeResults.map((pl) => (
              <li key={pl.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setRefPoint({ lat: pl.latitude, lon: pl.longitude, label: pl.name }); setPlaceResults(null); setLocMsg(""); }}>
                <span className="font-semibold">{pl.name}</span> <span className="text-muted-foreground">{[pl.admin1, pl.country].filter(Boolean).join(", ")} · {pl.latitude.toFixed(3)}, {pl.longitude.toFixed(3)}</span>
              </button></li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Place search: Open-Meteo Geocoding API (free, no key). Distances are straight-line kilometres from the place you pick. Enable location uses your browser position only to sort — it does not share or store your location.</p>
      </CardContent></Card>
      {shelters.loading ? <LoadingCards count={3} /> : shelters.error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{shelters.error}</p> : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-3">
            {rows.length === 0 ? <EmptyState title="No shelters match" description="Try a different search, or include full shelters." /> : rows.map(({ s, distKm }) => {
              const pct = s.capacity ? Math.round((s.occupied / s.capacity) * 100) : 0;
              return (
                <Card key={s.id}><CardContent className="py-4">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-display font-bold">{s.name}</span><StatusBadge status={s.status} />
                    {distKm !== null && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">≈ {distKm < 10 ? distKm.toFixed(1) : Math.round(distKm)} km away</span>}
                    <span className="ml-auto text-sm text-muted-foreground">{s.area}</span></div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.address}{s.contact ? ` · ${s.contact}` : ""}</p>
                  <div className="mt-3 flex items-center gap-3 text-sm"><BedDouble className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="font-semibold">{s.available} places free</span><span className="text-muted-foreground">of {s.capacity} ({s.occupied} occupied)</span></div>
                  <Progress value={pct} className="mt-2" aria-label={`Occupancy ${pct}%`} />
                  {s.accessibility && <p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">Accessibility:</strong> {s.accessibility}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Last updated {fmtDate(s.updatedAt)}</p>
                  {s.facilities.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{s.facilities.map((f) => <span key={f} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{f}</span>)}</div>}
                  <Button size="sm" variant="outline" className="mt-3" aria-expanded={needsOpen === s.id} onClick={() => setNeedsOpen(needsOpen === s.id ? null : s.id)}>{needsOpen === s.id ? "Hide relief needs" : "Relief needs & pledging"}</Button>
                  {needsOpen === s.id && <div className="mt-3 border-t pt-3"><ShelterNeedsPanel shelterId={s.id} staff={false} /></div>}
                </CardContent></Card>);
            })}
          </div>
          <div className="lg:col-span-2"><Card><CardContent className="p-2">{markers.length ? <MapView markers={markers} height={420} focus={refPoint ? { lat: refPoint.lat, lng: refPoint.lon, zoom: 11 } : null} /> : <p className="p-4 text-sm text-muted-foreground">No mapped shelters in this view.</p>}</CardContent></Card></div>
        </div>)}
    </div>
  );
}
