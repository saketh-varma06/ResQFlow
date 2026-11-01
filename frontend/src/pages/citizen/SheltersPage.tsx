import { useMemo, useState } from "react";
import { BedDouble, MapPin } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import MapView from "@/components/MapView";
import { api, type ListEnvelope } from "@/lib/api";
import { fmtDate, type ApiShelter } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

export default function SheltersPage() {
  const shelters = useApi(() => api<ListEnvelope<ApiShelter>>("/api/shelters?limit=100"));
  const [search, setSearch] = useState("");
  const [onlySpace, setOnlySpace] = useState(false);
  const rows = useMemo(() => (shelters.data?.data ?? []).filter((s) =>
    (!onlySpace || s.occupied < s.capacity) &&
    (search.trim() === "" || `${s.name} ${s.address} ${s.area}`.toLowerCase().includes(search.toLowerCase()))), [shelters.data, search, onlySpace]);
  const markers = rows.filter((s) => s.latitude && s.longitude).map((s) => ({ id: s.id, lat: s.latitude!, lng: s.longitude!, label: s.name, severity: (s.status === "FULL" ? "critical" : s.status === "NEARLY_FULL" ? "moderate" : "safe") as "critical" | "moderate" | "safe" }));
  return (
    <div>
      <PageHeader title="Find shelters" description="Live shelter list from the backend, with real capacity and occupancy." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Search by name, address or district…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search shelters" /></div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={onlySpace} onChange={(e) => setOnlySpace(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Only shelters with space</label>
      </div>
      {shelters.loading ? <LoadingCards count={3} /> : shelters.error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{shelters.error}</p> : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-3">
            {rows.length === 0 ? <EmptyState title="No shelters match" description="Try a different search, or include full shelters." /> : rows.map((s) => {
              const pct = s.capacity ? Math.round((s.occupied / s.capacity) * 100) : 0;
              return (
                <Card key={s.id}><CardContent className="py-4">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-display font-bold">{s.name}</span><StatusBadge status={s.status} />
                    <span className="ml-auto text-sm text-muted-foreground">{s.area}</span></div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.address}{s.contact ? ` · ${s.contact}` : ""}</p>
                  <div className="mt-3 flex items-center gap-3 text-sm"><BedDouble className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="font-semibold">{s.available} places free</span><span className="text-muted-foreground">of {s.capacity} ({s.occupied} occupied)</span></div>
                  <Progress value={pct} className="mt-2" aria-label={`Occupancy ${pct}%`} />
                  {s.accessibility && <p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">Accessibility:</strong> {s.accessibility}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Last updated {fmtDate(s.updatedAt)}</p>
                  {s.facilities.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{s.facilities.map((f) => <span key={f} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{f}</span>)}</div>}
                </CardContent></Card>);
            })}
          </div>
          <div className="lg:col-span-2"><Card><CardContent className="p-2">{markers.length ? <MapView markers={markers} height={420} /> : <p className="p-4 text-sm text-muted-foreground">No mapped shelters in this view.</p>}</CardContent></Card></div>
        </div>)}
    </div>
  );
}
