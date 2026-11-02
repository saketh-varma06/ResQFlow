import { useEffect, useState } from "react";
import { BellRing, Crosshair, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { titleCase, type ApiAlertSubscription } from "@/lib/apiTypes";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";
import { useApi } from "@/hooks/useApi";

const DISTRICTS = ["North District", "South District", "East District", "West District", "Central District"];

/**
 * Geo-targeted alert subscriptions + browser push (Stage B).
 * Subscriptions are matched on the server when an alert is published — by district,
 * or by distance from a chosen centre — so citizens hear about their own areas,
 * not just their registered home district.
 */
export function AlertSubscriptions() {
  const subs = useApi(() => api<ListEnvelope<ApiAlertSubscription>>("/api/alerts/subscriptions"));
  const [mode, setMode] = useState<"DISTRICT" | "RADIUS">("DISTRICT");
  const [area, setArea] = useState(DISTRICTS[0]);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusKm, setRadiusKm] = useState(10);
  const [minSeverity, setMinSeverity] = useState("");
  const [error, setError] = useState("");
  const [pushState, setPushState] = useState<PushState>("unsubscribed");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => { void getPushState().then(setPushState).catch(() => setPushState("unavailable")); }, []);

  async function add() {
    setError("");
    const payload: Record<string, unknown> = { mode, ...(minSeverity ? { minSeverity } : {}) };
    if (mode === "DISTRICT") payload.area = area;
    else { payload.centerLat = Number(lat); payload.centerLng = Number(lng); payload.radiusKm = radiusKm; }
    try { await api<Envelope<ApiAlertSubscription>>("/api/alerts/subscriptions", { method: "POST", body: JSON.stringify(payload) }); void subs.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not save the subscription."); }
  }
  async function remove(id: string) {
    setError("");
    try { await api(`/api/alerts/subscriptions/${id}`, { method: "DELETE" }); void subs.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not remove the subscription."); }
  }
  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition((pos) => { setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6)); }, () => setError("Location permission was denied — type the coordinates instead."), { timeout: 10000 });
  }
  async function togglePush() {
    setPushBusy(true);
    try { setPushState(pushState === "subscribed" ? await disablePush() : await enablePush()); }
    catch { setError("Browser push could not be changed on this device."); }
    finally { setPushBusy(false); }
  }

  const rows = subs.data?.data ?? [];
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>My alert areas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Get alerted for the places you care about — a district, or anywhere within a radius of a point (home, a parent's house, a work site). Matching happens on the server the moment an alert is published.</p>
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "DISTRICT" ? "default" : "outline"} onClick={() => setMode("DISTRICT")}>District</Button>
            <Button size="sm" variant={mode === "RADIUS" ? "default" : "outline"} onClick={() => setMode("RADIUS")}>Radius around a point</Button>
          </div>
          {mode === "DISTRICT" ? (
            <div className="space-y-1.5"><Label htmlFor="sub-area">District</Label>
              <Select id="sub-area" value={area} onChange={(e) => setArea(e.target.value)}>{DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}</Select></div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="sub-lat">Latitude</Label><Input id="sub-lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="28.6139" /></div>
                <div className="space-y-1.5"><Label htmlFor="sub-lng">Longitude</Label><Input id="sub-lng" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="77.2090" /></div>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5"><Label htmlFor="sub-radius">Radius (km)</Label><Input id="sub-radius" type="number" min={1} max={200} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} /></div>
                <Button type="button" variant="outline" onClick={useMyLocation}><Crosshair className="mr-1.5 h-4 w-4" aria-hidden /> Use my location</Button>
              </div>
            </div>
          )}
          <div className="space-y-1.5"><Label htmlFor="sub-sev">Minimum severity</Label>
            <Select id="sub-sev" value={minSeverity} onChange={(e) => setMinSeverity(e.target.value)}>
              <option value="">Any severity</option><option value="LOW">Low and above</option><option value="MODERATE">Moderate and above</option><option value="HIGH">High and above</option><option value="CRITICAL">Critical only</option>
            </Select></div>
          <Button onClick={() => void add()}>Add subscription</Button>
          <div className="space-y-2">
            {subs.loading ? <p className="text-sm text-muted-foreground">Loading…</p>
              : rows.length === 0 ? <p className="text-sm text-muted-foreground">No subscriptions yet — you currently only receive alerts for your profile district.</p>
              : rows.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="font-medium">{s.mode === "DISTRICT" ? s.area : `Within ${s.radiusKm} km of ${s.centerLat?.toFixed(3)}, ${s.centerLng?.toFixed(3)}`}</span>
                  {s.minSeverity && <span className="text-muted-foreground">· {titleCase(s.minSeverity)}+</span>}
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void remove(s.id)} aria-label="Remove subscription"><Trash2 className="h-4 w-4" aria-hidden /></Button>
                </div>))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" aria-hidden /> Browser notifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">With browser push on, alerts and updates reach this device even when ResQFlow is closed — delivered by your browser's push service, matched by the same subscriptions.</p>
          {pushState === "unsupported" && <p className="text-sm font-medium text-amber-700">This browser does not support push notifications.</p>}
          {pushState === "unavailable" && <p className="text-sm font-medium text-amber-700">Push is not configured on the server right now — in-app and realtime alerts still work.</p>}
          {pushState === "denied" && <p className="text-sm font-medium text-amber-700">Notifications are blocked in this browser's site settings.</p>}
          {pushState === "subscribed" && <p className="text-sm font-medium text-emerald-700">Browser push is ON for this device.</p>}
          {pushState === "unsubscribed" && <p className="text-sm text-muted-foreground">Browser push is off for this device.</p>}
          {(pushState === "subscribed" || pushState === "unsubscribed") && (
            <Button onClick={() => void togglePush()} disabled={pushBusy}>{pushState === "subscribed" ? "Turn off browser push" : "Turn on browser push"}</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
