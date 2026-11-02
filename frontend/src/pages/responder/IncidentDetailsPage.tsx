import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, NotebookPen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, SeverityBadge, StatusBadge, VerificationBadge } from "@/components/StatusBadge";
import { VerificationPanel } from "@/components/VerificationPanel";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import MapView from "@/components/MapView";
import { api, ApiError, type Envelope } from "@/lib/api";
import { NEXT_STATUSES, fmtDate, titleCase, type ApiIncident, type ApiRoute } from "@/lib/apiTypes";
import { DispatchPanel } from "@/components/DispatchPanel";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

export default function IncidentDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState<ApiRoute | null>(null);
  const detail = useApi(() => api<Envelope<ApiIncident>>(`/api/incidents/${id}`), [id]);
  const inc = detail.data?.data;

  async function changeStatus(status: string) {
    setError(""); setBusy(true);
    try { await api(`/api/incidents/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); void detail.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Status change failed."); }
    finally { setBusy(false); }
  }
  async function claimRelease(action: "claim" | "release") {
    setError(""); setBusy(true);
    try { await api(`/api/incidents/${id}/${action}`, { method: "POST" }); void detail.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Action failed."); }
    finally { setBusy(false); }
  }
  async function addNote() {
    if (note.trim().length === 0) return;
    setError(""); setBusy(true);
    try { await api(`/api/incidents/${id}/notes`, { method: "POST", body: JSON.stringify({ note: note.trim() }) }); setNote(""); void detail.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not add the note."); }
    finally { setBusy(false); }
  }

  if (detail.loading) return <div><PageHeader title="Incident details" /><LoadingCards count={3} /></div>;
  if (detail.error || !inc) return <div><PageHeader title="Incident details" /><EmptyState title="Incident not found" description={detail.error || "This incident does not exist."} action={<Button asChild><Link to="/responder">Back to command centre</Link></Button>} /></div>;

  const next = NEXT_STATUSES[inc.status] ?? [];
  const history = [...(inc.statusHistory ?? [])].reverse();
  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2"><Link to="/responder/assigned"><ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> Back</Link></Button>
      <PageHeader title={inc.title} description={`${titleCase(inc.type)} · ${inc.location}, ${inc.area} · Reported ${fmtDate(inc.createdAt)} by ${inc.reporter?.name ?? "citizen"}`} />
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <SeverityBadge severity={inc.severity} /><StatusBadge status={inc.status} /><PriorityBadge level={inc.priorityLevel} score={inc.priorityScore} /><VerificationBadge status={inc.verificationStatus} />
        <span className="text-sm text-muted-foreground">{inc.peopleAffected} people affected{inc.injuriesReported ? ` · ${inc.injuriesReported} injuries` : ""}{inc.trapped ? " · people trapped" : ""}</span>
        {inc.assignments && inc.assignments.length > 0 && <span className="text-sm text-muted-foreground">Unit: <strong className="text-foreground">{inc.assignments[0].responderProfile?.unitName}</strong> ({titleCase(inc.assignments[0].status)})</span>}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card><CardHeader><CardTitle>Description</CardTitle></CardHeader><CardContent><p className="text-sm leading-relaxed">{inc.description}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Why this priority?</CardTitle></CardHeader><CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{inc.priorityReasons.map((r) => <li key={r}>{r}</li>)}</ul>
            <p className="mt-2 text-xs text-muted-foreground">Rule-based sorting aid only — not a medically validated or officially approved triage algorithm.</p>
          </CardContent></Card>
          {(user?.role === "RESPONDER" || user?.role === "ADMIN") && <Card><CardHeader><CardTitle>Verification &amp; duplicates</CardTitle></CardHeader><CardContent>
            <VerificationPanel kind="incidents" id={inc.id} verificationStatus={inc.verificationStatus} duplicateOfId={inc.duplicateOfId} onChanged={() => void detail.reload()} />
          </CardContent></Card>}
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><NotebookPen className="h-4 w-4" aria-hidden /> Add a response note</CardTitle></CardHeader><CardContent>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Field update for the timeline — the reporter is notified" aria-label="Response note" />
            <Button className="mt-3" onClick={() => void addNote()} disabled={busy || note.trim().length === 0}>Add note</Button>
            {user?.role === "CITIZEN" && <p className="mt-2 text-xs text-muted-foreground">Only assigned responders and administrators can add notes.</p>}
          </CardContent></Card>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card><CardHeader><CardTitle>Update status</CardTitle></CardHeader><CardContent>
            {next.length === 0 ? <p className="text-sm text-muted-foreground">This incident is {inc.status.toLowerCase()} — no further transitions are allowed.</p> : (
              <div className="flex flex-wrap gap-2">{next.map((s) => <Button key={s} variant={s === "RESOLVED" || s === "CLOSED" ? "default" : "outline"} disabled={busy} onClick={() => void changeStatus(s)}>Move to {titleCase(s)}</Button>)}</div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Transitions are validated on the server against the workflow SUBMITTED → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED.</p>
            {user?.role === "RESPONDER" && (() => {
              const active = (inc.assignments ?? []).filter((a) => a.status === "PENDING" || a.status === "ACCEPTED");
              const mine = active.some((a) => a.responderProfile?.user?.id === user.id);
              if (mine && inc.status !== "IN_PROGRESS") return <div className="mt-4 border-t pt-3"><p className="mb-2 text-sm">Your unit holds the claim on this incident.</p><Button variant="outline" disabled={busy} onClick={() => void claimRelease("release")}>Release claim</Button></div>;
              if (active.length === 0 && ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED"].includes(inc.status)) return <div className="mt-4 border-t pt-3"><p className="mb-2 text-sm">Unclaimed — the first unit to claim it holds it exclusively.</p><Button disabled={busy} onClick={() => void claimRelease("claim")}>Claim this incident</Button></div>;
              if (active.length > 0 && !mine) return <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">Claimed by {active[0].responderProfile?.unitName} — it must release the claim before another unit can take it.</p>;
              return null;
            })()}
          </CardContent></Card>
          {inc.latitude && inc.longitude && <Card><CardContent className="p-2"><MapView
            markers={[{ id: inc.id, lat: inc.latitude, lng: inc.longitude, label: inc.title, severity: inc.severity === "CRITICAL" ? "critical" : inc.severity === "HIGH" ? "high" : inc.severity === "MODERATE" ? "moderate" : "low" },
              ...(route ? [{ id: `unit-${route.profileId}`, lat: route.geometry.coordinates[0][1], lng: route.geometry.coordinates[0][0], label: route.unitName, detail: `~${Math.round(route.durationMinutes)} min · ${route.distanceKm} km by road`, severity: "safe" as const, kind: "shelter" as const }] : [])]}
            routeLine={route ? route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]) : null}
            height={260} /></CardContent></Card>}
          {(user?.role === "RESPONDER" || user?.role === "ADMIN") && <Card><CardHeader><CardTitle>Nearest units</CardTitle></CardHeader><CardContent>
            <DispatchPanel kind="incidents" id={inc.id} canAssign={user?.role === "ADMIN"} onShowRoute={setRoute} onAssigned={() => void detail.reload()} />
          </CardContent></Card>}
          <Card><CardHeader><CardTitle>Timeline</CardTitle></CardHeader><CardContent>
            <ol className="relative space-y-3 border-l pl-4">
              {history.map((h) => (
                <li key={h.id} className="text-sm">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
                  <span className="font-semibold">{titleCase(h.toStatus)}</span>
                  <span className="text-muted-foreground"> · {fmtDate(h.createdAt)}{h.changedBy ? ` · ${h.changedBy.name}` : ""}</span>
                  {h.note && <p className="text-muted-foreground">{h.note}</p>}
                </li>))}
            </ol>
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}
