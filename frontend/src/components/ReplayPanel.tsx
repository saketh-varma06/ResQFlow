import { useEffect, useMemo, useRef, useState } from "react";
import { History, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import MapView, { type MapMarker } from "@/components/MapView";
import { api, type Envelope } from "@/lib/api";
import { fmtDate, type ApiReplay } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

/** After-action replay (Stage F): step through the period's status changes and
 *  audit entries in order; mapped events appear on the map as the replay reaches them. */
export function ReplayPanel() {
  const [hours, setHours] = useState(24);
  const replay = useApi(() => api<Envelope<ApiReplay>>(`/api/analytics/replay?hours=${hours}`), [hours]);
  const events = useMemo(() => replay.data?.data.events ?? [], [replay.data]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => { setStep(0); setPlaying(false); }, [hours, replay.data]);
  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setStep((s) => {
        if (s >= events.length - 1) { setPlaying(false); return s; }
        return s + 1;
      });
    }, 700);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, events.length]);

  const markers: MapMarker[] = events.slice(0, step + 1)
    .filter((e) => e.latitude != null && e.longitude != null)
    .map((e, i) => ({ id: `${e.entityId}-${i}`, lat: e.latitude!, lng: e.longitude!, label: e.title, detail: e.detail, severity: e.kind === "STATUS" ? "high" as const : "low" as const, kind: e.entityType === "SOS" ? "sos" as const : "incident" as const }));

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-red-700" aria-hidden /> After-action replay</CardTitle>
        <Select aria-label="Replay window" className="w-36" value={String(hours)} onChange={(e) => setHours(Number(e.target.value))}>
          <option value="24">Last 24 hours</option>
          <option value="72">Last 3 days</option>
          <option value="168">Last 7 days</option>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={events.length === 0} onClick={() => { if (step >= events.length - 1) setStep(0); setPlaying((p) => !p); }}>
            {playing ? <><Pause className="mr-1.5 h-4 w-4" aria-hidden /> Pause</> : <><Play className="mr-1.5 h-4 w-4" aria-hidden /> Play</>}
          </Button>
          <input type="range" min={0} max={Math.max(0, events.length - 1)} value={step} disabled={events.length === 0}
            onChange={(e) => setStep(Number(e.target.value))} aria-label="Replay position" className="w-44 accent-red-700" />
          <span className="text-sm text-muted-foreground">{events.length ? step + 1 : 0} / {events.length} events</span>
        </div>
      </CardHeader>
      <CardContent>
        {replay.loading ? <p className="text-sm text-muted-foreground">Loading events…</p>
          : events.length === 0 ? <p className="text-sm text-muted-foreground">No status changes or audited actions in this window.</p>
          : (
            <div className="grid gap-4 lg:grid-cols-2">
              <ol className="max-h-80 space-y-1 overflow-y-auto pr-1 text-sm">
                {events.map((e, i) => (
                  <li key={`${e.at}-${i}`} className={`rounded px-2 py-1.5 ${i === step ? "bg-red-50 ring-1 ring-red-300" : i < step ? "" : "opacity-50"}`}>
                    <span className="font-semibold">{fmtDate(e.at)}</span> · <span className={e.kind === "STATUS" ? "text-red-700" : "text-slate-500"}>{e.kind === "STATUS" ? "Status" : "Action"}</span>
                    <br />{e.title} <span className="text-muted-foreground">— {e.detail}</span>
                  </li>
                ))}
              </ol>
              <div>{markers.length ? <MapView markers={markers} height={320} /> : <p className="p-4 text-sm text-muted-foreground">Events up to this step have no map coordinates.</p>}</div>
            </div>
          )}
        {replay.data?.data.truncated && <p className="mt-2 text-xs text-muted-foreground">Showing the first 500 events in the window.</p>}
      </CardContent>
    </Card>
  );
}
