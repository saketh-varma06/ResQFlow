import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Crosshair } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, SeverityBadge, StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { enqueueOutbox } from "@/lib/outbox";
import { INCIDENT_TYPES, fmtDate, titleCase, type ApiIncident } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

const SEVERITIES = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;

export default function ReportPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(() => {
    const base = { title: "", type: "FLOOD", severity: "MODERATE", description: "", location: "", area: user?.area ?? "North District", peopleAffected: 0, injuriesReported: 0, trapped: false };
    try { const raw = localStorage.getItem("resqflow_report_draft_v1"); if (raw) return { ...base, ...(JSON.parse(raw) as Partial<typeof base>) }; } catch { /* fresh form */ }
    return base;
  });
  const [queuedLocally, setQueuedLocally] = useState(false);
  // Drafts persist locally so a report survives a dropped connection or a closed tab.
  useEffect(() => { try { localStorage.setItem("resqflow_report_draft_v1", JSON.stringify(form)); } catch { /* storage unavailable */ } }, [form]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<ApiIncident | null>(null);
  const mine = useApi(() => api<ListEnvelope<ApiIncident>>("/api/incidents?mine=true&limit=10"), [created?.id]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));

  function locate() {
    if (!("geolocation" in navigator)) { setGeoMsg("Geolocation is not available in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }); setGeoMsg(""); },
      () => setGeoMsg("Location permission denied — coordinates are optional for a report."),
      { timeout: 10000 }
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (form.title.trim().length < 5) { setError("Give the incident a short title (at least 5 characters)."); return; }
    if (form.description.trim().length < 10) { setError("Describe what happened (at least 10 characters)."); return; }
    if (form.location.trim().length < 3) { setError("Enter where this is happening."); return; }
    setBusy(true);
    try {
      const payload = { ...form, title: form.title.trim(), description: form.description.trim(), location: form.location.trim(), latitude: coords?.lat, longitude: coords?.lng };
      const r = await api<Envelope<ApiIncident>>("/api/incidents", { method: "POST", body: JSON.stringify(payload) });
      localStorage.removeItem("resqflow_report_draft_v1");
      setCreated(r.data);
      setForm((f) => ({ ...f, title: "", description: "", location: "", peopleAffected: 0, injuriesReported: 0, trapped: false }));
      setCoords(null);
    } catch (err) {
      const retryable = !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
      if (retryable) {
        enqueueOutbox("incident", { ...form, title: form.title.trim(), description: form.description.trim(), location: form.location.trim(), latitude: coords?.lat, longitude: coords?.lng });
        localStorage.removeItem("resqflow_report_draft_v1");
        setQueuedLocally(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Could not submit the report.");
      }
    }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Report an incident" description="Reports go straight to the district control room and are prioritised with an explainable rule-based score." />
      {queuedLocally && (
        <Card className="mb-6 border-amber-300 bg-amber-50"><CardContent className="py-5 text-amber-900">
          <p className="font-display text-lg font-bold">Report queued — not yet received by the server</p>
          <p className="mt-1 text-sm">The connection dropped before the server confirmed your report. It is saved in this device's outbox and will send automatically when you reconnect (watch the status box at the bottom-left). Responders cannot see it until the server confirms it.</p>
        </CardContent></Card>
      )}
      {created && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50/60"><CardContent className="py-5">
          <div className="flex flex-wrap items-start gap-3"><CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
            <div className="flex-1">
              <p className="font-display text-lg font-bold">Report received — reference <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px]">{created.id}</code></p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><StatusBadge status={created.status} /><PriorityBadge level={created.priorityLevel} score={created.priorityScore} /><span className="text-muted-foreground">{created.title}</span></div>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{created.priorityReasons.map((r) => <li key={r}>{r}</li>)}</ul>
              <Button asChild size="sm" className="mt-3"><Link to="/citizen/requests">Track my reports</Link></Button>
            </div></div>
        </CardContent></Card>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3"><CardHeader><CardTitle>Incident details</CardTitle></CardHeader><CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5"><Label htmlFor="title">Title</Label><Input id="title" value={form.title} onChange={set("title")} placeholder="e.g. Flooding on Riverbank Road" required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="type">Category</Label><Select id="type" value={form.type} onChange={set("type")}>{INCIDENT_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select></div>
              <div className="space-y-1.5"><Label>Severity</Label>
                <div className="grid grid-cols-4 gap-1.5">{SEVERITIES.map((s) => (
                  <button key={s} type="button" aria-pressed={form.severity === s} onClick={() => setForm((f) => ({ ...f, severity: s }))}
                    className={`rounded-lg border px-2 py-2 text-xs font-bold ${form.severity === s ? "border-red-600 bg-red-50 text-red-800" : "hover:border-slate-300"}`}>{titleCase(s)}</button>))}
                </div></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="description">Description</Label><Textarea id="description" rows={4} value={form.description} onChange={set("description")} placeholder="What happened, since when, what is at risk…" required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="location">Location</Label><Input id="location" value={form.location} onChange={set("location")} placeholder="Street / landmark" required /></div>
              <div className="space-y-1.5"><Label htmlFor="area">District</Label><Select id="area" value={form.area} onChange={set("area")}>{["North District", "South District", "East District", "West District", "Central District"].map((a) => <option key={a} value={a}>{a}</option>)}</Select></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label htmlFor="peopleAffected">People affected</Label><Input id="peopleAffected" type="number" min={0} value={form.peopleAffected} onChange={set("peopleAffected")} /></div>
              <div className="space-y-1.5"><Label htmlFor="injuriesReported">Reported injuries</Label><Input id="injuriesReported" type="number" min={0} value={form.injuriesReported} onChange={set("injuriesReported")} /></div>
              <div className="flex items-end pb-1"><Button type="button" variant="outline" onClick={locate}><Crosshair className="mr-1.5 h-4 w-4" aria-hidden />{coords ? `${coords.lat}, ${coords.lng}` : "Add my coordinates"}</Button></div>
            </div>
            {geoMsg && <p className="text-xs font-medium text-amber-700">{geoMsg}</p>}
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium">
              <input type="checkbox" checked={form.trapped} onChange={(e) => setForm((f) => ({ ...f, trapped: e.target.checked }))} className="h-4 w-4 accent-red-600" />
              People are trapped or stranded at this location
            </label>
            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Submitting…" : "Submit report"}</Button>
          </form>
        </CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle>My recent reports</CardTitle></CardHeader><CardContent className="space-y-3">
          {mine.loading ? <LoadingCards count={2} /> : mine.error ? <p role="alert" className="text-sm text-red-700">{mine.error}</p>
            : !mine.data || mine.data.data.length === 0 ? <EmptyState title="No reports yet" description="Incidents you report will be listed here." />
            : mine.data.data.map((i) => (
              <div key={i.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{i.title}</span><span className="ml-auto flex gap-1.5"><SeverityBadge severity={i.severity} /><StatusBadge status={i.status} /></span></div>
                <p className="mt-1 text-muted-foreground">{titleCase(i.type)} · {i.location} · {fmtDate(i.createdAt)}</p>
              </div>))}
        </CardContent></Card>
      </div>
    </div>
  );
}
