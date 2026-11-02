import { CloudRainWind, Globe2, Mountain, RefreshCw, Satellite, Waves } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type Envelope } from "@/lib/api";
import { fmtDate, type ExtOverview, type ExtSource } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

function SourceMeta<T>({ s }: { s: ExtSource<T> }) {
  return (
    <p className="text-xs text-muted-foreground">
      Source: <a className="font-semibold underline" href={s.sourceUrl} target="_blank" rel="noreferrer">{s.source}</a>
      {" "}· Fetched {new Date(s.fetchedAt).toLocaleString()}
      {s.stale && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Showing last good copy — source refresh failed{s.error ? ` (${s.error})` : ""}</span>}
      {s.status === "unavailable" && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-800">Source unavailable right now — no data shown rather than invented data</span>}
    </p>
  );
}
const levelCls = (l: string) => l === "RED" ? "bg-red-600 text-white" : l === "ORANGE" ? "bg-orange-500 text-white" : l === "GREEN" ? "bg-emerald-600 text-white" : "bg-slate-400 text-white";

export default function ExternalDataPanel() {
  const ext = useApi(() => api<Envelope<ExtOverview>>("/api/external/overview"));
  const d = ext.data?.data;
  return (
    <section aria-label="External data from public sources" className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Globe2 className="h-5 w-5 text-sky-700" aria-hidden /> Weather &amp; hazard feeds</h2>
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">Live external data — public sources, not ResQFlow records</span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => void ext.reload()} disabled={ext.loading}><RefreshCw className={`mr-1.5 h-4 w-4 ${ext.loading ? "animate-spin" : ""}`} aria-hidden /> Refresh</Button>
      </div>
      {ext.loading && !d ? <p className="text-sm text-muted-foreground">Fetching from public sources…</p>
        : ext.error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{ext.error}</p>
        : d && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CloudRainWind className="h-4 w-4 text-sky-700" aria-hidden /> Weather — Delhi area</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              {d.weather.data ? (<>
                <p className="font-display text-2xl font-bold">{d.weather.data.temperatureC}°C <span className="text-base font-semibold text-muted-foreground">{d.weather.data.condition}</span></p>
                <p className="text-muted-foreground">Humidity {d.weather.data.humidityPct}% · Rain {d.weather.data.rainMm} mm · Wind {d.weather.data.windKph} km/h (gusts {d.weather.data.windGustsKph})</p>
                <div className="space-y-1">{d.weather.data.forecast.map((f) => (
                  <p key={f.date} className="flex justify-between rounded bg-slate-50 px-2 py-1 text-xs"><span>{f.date}</span><span className="font-semibold">Rain {f.precipitationMm} mm{f.precipitationProbabilityPct !== null ? ` · ${f.precipitationProbabilityPct}% likely` : ""}</span></p>))}
                </div>
              </>) : <p className="text-muted-foreground">No weather data available.</p>}
              <SourceMeta s={d.weather} />
            </CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Mountain className="h-4 w-4 text-orange-700" aria-hidden /> Earthquakes — region (M4.5+, 24h)</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              {d.earthquakes.data ? (d.earthquakes.data.length ? d.earthquakes.data.slice(0, 5).map((q) => (
                <p key={q.id} className="rounded bg-slate-50 px-2 py-1.5"><span className="font-bold">M{q.magnitude}</span> {q.place}<br /><span className="text-xs text-muted-foreground">{fmtDate(q.time)} · depth {q.depthKm} km{q.tsunami ? " · tsunami evaluation" : ""} · <a className="underline" href={q.url} target="_blank" rel="noreferrer">USGS event</a></span></p>
              )) : <p className="text-muted-foreground">No M4.5+ earthquakes in the region in the past day.</p>) : <p className="text-muted-foreground">No earthquake data available.</p>}
              <SourceMeta s={d.earthquakes} />
            </CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-base">GDACS disaster alerts</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              {d.gdacs.data ? (d.gdacs.data.length ? d.gdacs.data.slice(0, 5).map((g) => (
                <p key={g.link} className="rounded bg-slate-50 px-2 py-1.5">
                  <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${levelCls(g.alertLevel)}`}>{g.alertLevel}</span>
                  <a className="font-medium underline" href={g.link} target="_blank" rel="noreferrer">{g.title}</a>
                  <br /><span className="text-xs text-muted-foreground">{g.eventType} · {fmtDate(g.publishedAt)}{g.indiaRelated ? " · India-related" : ""}</span></p>
              )) : <p className="text-muted-foreground">No current GDACS alerts.</p>) : <p className="text-muted-foreground">No GDACS data available.</p>}
              <SourceMeta s={d.gdacs} />
            </CardContent></Card>
            {d.flood && <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Waves className="h-4 w-4 text-blue-700" aria-hidden /> River discharge — flood watch (GloFAS)</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              {d.flood.data ? (d.flood.data.length ? d.flood.data.map((f) => (
                <p key={f.name} className="rounded bg-slate-50 px-2 py-1.5"><span className="font-semibold">{f.name}</span><br />
                  <span className="text-xs text-muted-foreground">Today {f.dischargeToday} {f.unit} · 7-day max {f.maxDischarge7d} {f.unit} · trend {f.trend}</span></p>
              )) : <p className="text-muted-foreground">No discharge data for the watch points.</p>) : <p className="text-muted-foreground">No flood-watch data available.</p>}
              <SourceMeta s={d.flood} />
            </CardContent></Card>}
            {d.eonet && <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Satellite className="h-4 w-4 text-violet-700" aria-hidden /> Natural events — NASA EONET (region)</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              {d.eonet.data ? (d.eonet.data.length ? d.eonet.data.slice(0, 5).map((e) => (
                <p key={e.id} className="rounded bg-slate-50 px-2 py-1.5"><a className="font-medium underline" href={e.link} target="_blank" rel="noreferrer">{e.title}</a><br />
                  <span className="text-xs text-muted-foreground">{e.categories.join(", ") || "Event"} · {fmtDate(e.date)}</span></p>
              )) : <p className="text-muted-foreground">No open natural events tracked in the region right now.</p>) : <p className="text-muted-foreground">No EONET data available.</p>}
              <SourceMeta s={d.eonet} />
            </CardContent></Card>}
          </div>)}
    </section>
  );
}
