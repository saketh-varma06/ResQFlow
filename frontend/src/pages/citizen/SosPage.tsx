import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Crosshair, Loader2, MapPin, Siren, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { enqueueOutbox } from "@/lib/outbox";
import { SOS_CATEGORIES, fmtDate, titleCase, type ApiSos } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

type GeoState = "idle" | "asking" | "granted" | "denied" | "unavailable";

export default function SosPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState("FLOOD");
  const [need, setNeed] = useState("");
  const [details, setDetails] = useState("");
  const [people, setPeople] = useState(1);
  const [injuries, setInjuries] = useState(0);
  const [trapped, setTrapped] = useState(false);
  const [location, setLocation] = useState("");
  const [area, setArea] = useState(user?.area ?? "North District");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<ApiSos | null>(null);
  const [queuedLocally, setQueuedLocally] = useState(false);
  const mine = useApi(() => api<ListEnvelope<ApiSos>>("/api/sos?limit=10"), [created?.id]);

  function useMyLocation() {
    if (!("geolocation" in navigator)) { setGeo("unavailable"); return; }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }); setGeo("granted"); },
      () => setGeo("denied"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function validate(): string {
    if (need.trim().length < 3) return "Describe the emergency briefly (at least 3 characters).";
    if (location.trim().length < 3) return "Enter your location, or share it with the location button.";
    if (people < 1) return "At least 1 person must be affected.";
    return "";
  }

  async function submit() {
    setBusy(true); setError("");
    const payload = {
      need: need.trim(), category, people, injuriesReported: injuries, trapped,
      location: location.trim(), area, details: details.trim() || undefined, phone: phone.trim() || undefined,
      latitude: coords?.lat, longitude: coords?.lng,
    };
    try {
      const r = await api<Envelope<ApiSos>>("/api/sos", { method: "POST", body: JSON.stringify(payload) });
      setCreated(r.data);
      setConfirmOpen(false);
      setNeed(""); setDetails(""); setInjuries(0); setTrapped(false);
    } catch (err) {
      const retryable = !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
      if (retryable) {
        // The server did NOT confirm receipt — queue on this device and say so.
        enqueueOutbox("sos", payload);
        setQueuedLocally(true);
      } else {
        setError(err instanceof ApiError ? err.message : "The server rejected this request.");
      }
      setConfirmOpen(false);
    } finally { setBusy(false); }
  }

  async function cancel(id: string) {
    try { await api(`/api/sos/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }); void mine.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not cancel this request."); }
  }

  return (
    <div>
      <PageHeader title="SOS Emergency" description="Send an emergency request to the district control room. Responders are notified in real time." />
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p><strong>Life-threatening emergency? Call 112 first.</strong> This form sends a request inside ResQFlow only — it does not automatically contact emergency services.</p>
      </div>

      {queuedLocally && (
        <Card className="mb-6 border-amber-300 bg-amber-50"><CardContent className="py-5 text-amber-900">
          <p className="font-display text-lg font-bold">SOS not sent yet — saved on this device only</p>
          <p className="mt-1 text-sm">The connection dropped before the server confirmed your SOS. It is queued in this device's outbox and will send automatically when you reconnect — responders cannot see it until then. <strong>If anyone is in immediate danger, call 112 now.</strong></p>
          <Button className="mt-3" variant="outline" onClick={() => setQueuedLocally(false)}>Dismiss</Button>
        </CardContent></Card>
      )}
      {created && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50/60">
          <CardContent className="py-5">
            <div className="flex flex-wrap items-start gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold">SOS request received</p>
                <p className="mt-1 text-sm">Your unique request ID is <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px] font-semibold">{created.id}</code> — quote it when tracking or calling the control room.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <StatusBadge status={created.status} />
                  <PriorityBadge level={created.priorityLevel} score={created.priorityScore} />
                  <span className="text-muted-foreground">{titleCase(created.category)} · {created.location}</span>
                </div>
                <div className="mt-3 rounded-lg bg-white/70 p-3 text-sm">
                  <p className="font-semibold">Why this priority?</p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">{created.priorityReasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  <p className="mt-2 text-xs text-muted-foreground">Priority is a rule-based sorting aid for dispatchers — not a medically validated triage algorithm.</p>
                </div>
                <Button asChild className="mt-4" size="sm"><Link to="/citizen/requests">Track this request</Link></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="flex items-center gap-2"><Siren className="h-5 w-5 text-red-600" aria-hidden /> New SOS request</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); const v = validate(); if (v) { setError(v); return; } setError(""); setConfirmOpen(true); }} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="category">Emergency category</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SOS_CATEGORIES.map((c) => (
                    <button key={c.value} type="button" onClick={() => setCategory(c.value)} aria-pressed={category === c.value}
                      className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${category === c.value ? "border-red-600 bg-red-50 text-red-800" : "hover:border-slate-300"}`}>{c.label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="need">What is the emergency?</Label><Input id="need" value={need} onChange={(e) => setNeed(e.target.value)} placeholder="e.g. Water entering home, need evacuation" required /></div>
              <div className="space-y-1.5"><Label htmlFor="details">Details (optional)</Label><Textarea id="details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="Landmarks, floor number, medical conditions, anything responders should know" /></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5"><Label htmlFor="people">People affected</Label><Input id="people" type="number" min={1} max={500} value={people} onChange={(e) => setPeople(Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label htmlFor="injuries">Reported injuries</Label><Input id="injuries" type="number" min={0} max={1000} value={injuries} onChange={(e) => setInjuries(Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label htmlFor="phone">Callback phone</Label><Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" /></div>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium">
                <input type="checkbox" checked={trapped} onChange={(e) => setTrapped(e.target.checked)} className="h-4 w-4 accent-red-600" />
                People are trapped or stranded and cannot leave on their own
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input id="location" className="pl-9" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="House / street / landmark" required /></div>
                  <Button type="button" variant="outline" onClick={useMyLocation} disabled={geo === "asking"}>
                    {geo === "asking" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Crosshair className="mr-1.5 h-4 w-4" aria-hidden />} Use my location
                  </Button>
                </div>
                {geo === "granted" && coords && <p className="text-xs font-medium text-emerald-700">Location shared: {coords.lat}, {coords.lng} (sent with your request)</p>}
                {geo === "denied" && <p className="text-xs font-medium text-amber-700">Location permission was denied — enter your location manually above; your request still works.</p>}
                {geo === "unavailable" && <p className="text-xs font-medium text-amber-700">This browser cannot share location — enter it manually above.</p>}
              </div>
              <div className="space-y-1.5"><Label htmlFor="area">District</Label>
                <Select id="area" value={area} onChange={(e) => setArea(e.target.value)}>{["North District", "South District", "East District", "West District", "Central District"].map((a) => <option key={a} value={a}>{a}</option>)}</Select></div>
              {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
              <Button type="submit" size="lg" className="w-full bg-red-600 hover:bg-red-700">Review &amp; send SOS</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>My recent SOS requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {mine.loading ? <LoadingCards count={2} /> : mine.error ? <p role="alert" className="text-sm text-red-700">{mine.error}</p>
              : !mine.data || mine.data.data.length === 0 ? <EmptyState title="No SOS requests yet" description="Requests you submit appear here with live status." />
              : mine.data.data.map((s) => (
                <div key={s.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{s.need}</span><span className="ml-auto flex gap-1.5"><PriorityBadge level={s.priorityLevel} score={s.priorityScore} /><StatusBadge status={s.status} /></span></div>
                  <p className="mt-1 text-muted-foreground">{titleCase(s.category)} · {s.location} · {fmtDate(s.createdAt)}</p>
                  {s.responderProfile && <p className="mt-1 text-muted-foreground">Unit: {s.responderProfile.unitName}</p>}
                  {(s.status === "SUBMITTED" || s.status === "ACKNOWLEDGED") && <Button size="sm" variant="outline" className="mt-2" onClick={() => void cancel(s.id)}>Cancel request</Button>}
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm SOS request</DialogTitle><DialogDescription>Check the details — responders will act on exactly this information.</DialogDescription></DialogHeader>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Category</dt><dd className="font-semibold">{titleCase(category)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Emergency</dt><dd className="text-right font-semibold">{need}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Location</dt><dd className="text-right font-semibold">{location}{coords ? ` (${coords.lat}, ${coords.lng})` : ""}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">People / injuries</dt><dd className="font-semibold">{people} / {injuries}{trapped ? " · trapped" : ""}</dd></div>
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Go back</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => void submit()} disabled={busy}>{busy ? "Sending…" : "Send SOS now"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
