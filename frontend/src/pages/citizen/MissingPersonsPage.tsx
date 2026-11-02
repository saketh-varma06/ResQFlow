import { useState } from "react";
import { HeartHandshake, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, type ApiMissingPerson } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

const EMPTY = { fullName: "", ageApprox: "", gender: "", description: "", lastSeenLocation: "", area: "", circumstances: "", reporterRelationship: "", reporterPhone: "" };

/**
 * Family tracing (Stage G). Privacy by design: there is no public list of missing
 * people here — a citizen sees ONLY their own reports. Tracing teams (responders
 * and admins) work the full registry on their side.
 */
export default function MissingPersonsPage() {
  const mine = useApi(() => api<ListEnvelope<ApiMissingPerson>>("/api/missing-persons?mine=true"));
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filed, setFiled] = useState<ApiMissingPerson | null>(null);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await api<Envelope<ApiMissingPerson>>("/api/missing-persons", { method: "POST", body: JSON.stringify({ ...form, ageApprox: form.ageApprox ? Number(form.ageApprox) : undefined, description: form.description.trim() || undefined, area: form.area.trim() || undefined, circumstances: form.circumstances.trim() || undefined }) });
      setFiled(r.data);
      setForm(EMPTY);
      void mine.reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not file the report."); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Missing persons — family tracing" description="Report a missing family member to the response teams who are searching. If someone is in immediate danger, call 112 first." />
      <p className="mb-4 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span><strong>Your privacy is protected:</strong> this is not a public list. Only you and the responder/admin tracing teams can see your report and your contact number. You will be notified here the moment there is an update.</span></p>
      {filed && <p role="status" className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">Report filed for <strong>{filed.fullName}</strong> (reference {filed.id.slice(-6).toUpperCase()}). Tracing teams have been given your contact number.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-red-700" aria-hidden /> Report a missing person</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submit}>
              {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
              <div className="space-y-1.5"><Label htmlFor="mp-name">Full name of the missing person</Label><Input id="mp-name" value={form.fullName} onChange={set("fullName")} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="mp-age">Approximate age</Label><Input id="mp-age" type="number" min={0} max={120} value={form.ageApprox} onChange={set("ageApprox")} /></div>
                <div className="space-y-1.5"><Label htmlFor="mp-gender">Gender</Label><Input id="mp-gender" value={form.gender} onChange={set("gender")} /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="mp-desc">Description (clothing, distinguishing features)</Label><Textarea id="mp-desc" value={form.description} onChange={set("description")} /></div>
              <div className="space-y-1.5"><Label htmlFor="mp-loc">Last seen — location</Label><Input id="mp-loc" value={form.lastSeenLocation} onChange={set("lastSeenLocation")} required placeholder="Street / landmark" /></div>
              <div className="space-y-1.5"><Label htmlFor="mp-area">District / area</Label><Input id="mp-area" value={form.area} onChange={set("area")} /></div>
              <div className="space-y-1.5"><Label htmlFor="mp-circ">Circumstances</Label><Textarea id="mp-circ" value={form.circumstances} onChange={set("circumstances")} placeholder="What happened, when were they last seen, where might they have gone…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="mp-rel">Your relationship</Label><Input id="mp-rel" value={form.reporterRelationship} onChange={set("reporterRelationship")} required placeholder="Mother, brother, friend…" /></div>
                <div className="space-y-1.5"><Label htmlFor="mp-phone">Your phone (for tracing teams)</Label><Input id="mp-phone" value={form.reporterPhone} onChange={set("reporterPhone")} required /></div>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Filing…" : "File missing person report"}</Button>
            </form>
          </CardContent>
        </Card>
        <div>
          <h2 className="mb-3 font-display text-lg font-bold">My reports</h2>
          {mine.loading ? <LoadingCards count={2} /> : (mine.data?.data ?? []).length === 0
            ? <EmptyState title="No reports filed" description="Reports you file will appear here with their current search status." />
            : <div className="space-y-3">{(mine.data?.data ?? []).map((p) => (
              <Card key={p.id}><CardContent className="py-4">
                <div className="flex flex-wrap items-center gap-2"><span className="font-display font-bold">{p.fullName}</span><StatusBadge status={p.status} />
                  <span className="ml-auto text-xs text-muted-foreground">Filed {fmtDate(p.createdAt)}</span></div>
                <p className="mt-1 text-sm text-muted-foreground">Last seen: {p.lastSeenLocation}{p.area ? ` · ${p.area}` : ""}{p.ageApprox ? ` · age ~${p.ageApprox}` : ""}</p>
                {p.resolutionNote && <p className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-sm"><strong>Update from tracing team:</strong> {p.resolutionNote}</p>}
              </CardContent></Card>))}
            </div>}
        </div>
      </div>
    </div>
  );
}
