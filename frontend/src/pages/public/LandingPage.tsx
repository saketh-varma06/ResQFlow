import { Link } from "react-router-dom";
import { ArrowRight, BellRing, Building2, ClipboardCheck, LifeBuoy, MapPin, RadioTower, ShieldCheck, Siren, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/StatusBadge";
import MapView from "@/components/MapView";
import { api, type ListEnvelope } from "@/lib/api";
import { titleCase, type ApiAlert, type ApiShelter } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

const features = [
  { icon: Siren, title: "One-tap SOS", text: "Citizens send an SOS with their location and need, routed straight to the responder command centre." },
  { icon: TriangleAlert, title: "Incident reporting", text: "Structured reports with type, severity and location help control rooms verify and prioritise fast." },
  { icon: BellRing, title: "Targeted alerts", text: "District-level flood, weather, traffic and utility alerts with clear safety instructions." },
  { icon: Building2, title: "Shelter finder", text: "Live shelter capacity, facilities and accessibility — so people go where there is actually space." },
  { icon: RadioTower, title: "Responder coordination", text: "Units see assigned incidents and incoming SOS in one dark, glanceable operations view." },
  { icon: ShieldCheck, title: "Accountable control", text: "Admins manage incidents, alerts, shelters and users with a full audit trail of every action." },
];
export default function LandingPage() {
  // Public, live data: shelters and alerts are readable without an account.
  const sheltersQ = useApi(() => api<ListEnvelope<ApiShelter>>("/api/shelters?limit=50"));
  const alertsQ = useApi(() => api<ListEnvelope<ApiAlert>>("/api/alerts?limit=5"));
  const liveShelters = (sheltersQ.data?.data ?? []).filter((s) => s.status !== "CLOSED");
  const sheltersWithSpace = [...liveShelters].sort((a, b) => b.available - a.available).slice(0, 3);
  const mapShelters = liveShelters.filter((s) => s.latitude !== null && s.longitude !== null).slice(0, 8);
  const liveAlerts = alertsQ.data?.data ?? [];
  return (
    <div>
      {/* Hero */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="fade-up">
            <Badge variant="critical" className="mb-4">Emergency operations platform</Badge>
            <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">Help, coordinated<br />at the speed of the<br /><span className="text-red-500">emergency.</span></h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-300">ResQFlow connects citizens, responders and administrators in one system — SOS requests, verified incidents, targeted alerts and shelter capacity, all in real time.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/register">Get started <ArrowRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button>
              <Button asChild size="lg" variant="secondary"><Link to="/citizen/sos">Preview the SOS flow</Link></Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 text-center sm:text-left">
              {[["< 15 min", "Target first response"], ["3 roles", "One shared picture"], ["24 × 7", "Operations coverage"]].map(([v, l]) => (
                <div key={l}><dt className="sr-only">{l}</dt><dd className="font-display text-2xl font-bold">{v}</dd><dd className="mt-0.5 text-xs text-slate-400">{l}</dd></div>
              ))}
            </dl>
          </div>
          <div className="fade-up">
            <Card className="border-white/10 bg-white/5 text-white shadow-lift">
              <CardHeader><CardTitle className="flex items-center gap-2"><LifeBuoy className="h-5 w-5 text-red-500" aria-hidden /> Operations picture — live</CardTitle><CardDescription className="text-slate-400">Real shelter locations and currently active alerts, straight from the ResQFlow network.</CardDescription></CardHeader>
              <CardContent>
                {sheltersQ.loading ? <p className="py-10 text-center text-sm text-slate-400">Loading live shelter map…</p>
                  : sheltersQ.error ? <p className="py-10 text-center text-sm text-slate-400">Live data is unavailable right now. Sign in for the full picture.</p>
                  : <MapView height={300} zoom={11} markers={mapShelters.map((s) => ({ id: s.id, lat: s.latitude!, lng: s.longitude!, label: s.name, detail: `${s.available} of ${s.capacity} places free · ${s.area}`, severity: s.status === "FULL" ? "high" as const : "safe" as const, kind: "shelter" as const }))} />}
                <ul className="mt-4 space-y-2">
                  {liveAlerts.slice(0, 2).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm"><SeverityBadge severity={a.severity} /><span className="flex-1">{a.title}</span><span className="text-xs text-slate-400">{a.area}</span></li>
                  ))}
                  {!alertsQ.loading && liveAlerts.length === 0 && <li className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300">No active alerts right now.</li>}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="features-h">
        <h2 id="features-h" className="font-display text-3xl font-bold text-slate-900">Built for the worst day, designed for every day</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Every workflow — from a citizen's SOS to an administrator's audit log — lives in one consistent, accessible interface.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="transition-shadow hover:shadow-lift">
              <CardContent className="p-6"><span className="inline-flex rounded-xl bg-red-50 p-3 text-red-700"><f.icon className="h-6 w-6" aria-hidden /></span><h3 className="mt-4 font-display text-lg font-semibold text-slate-900">{f.title}</h3><p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p></CardContent>
            </Card>
          ))}
        </div>
      </section>
      {/* Roles */}
      <section className="bg-white" aria-labelledby="roles-h">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 id="roles-h" className="font-display text-3xl font-bold text-slate-900">One platform, three missions</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {[
              { to: "/login", icon: MapPin, title: "Citizens", text: "A calm, light interface: send SOS, report incidents, find shelters with space, and track your requests.", cta: "Open the citizen app" },
              { to: "/login", icon: ClipboardCheck, title: "Responders", text: "A dark navy command centre: assigned incidents, incoming SOS and response history at a glance.", cta: "Open the command centre" },
              { to: "/login", icon: ShieldCheck, title: "Administrators", text: "Full operational control: incidents, alerts, shelters, users, responders, analytics and audit logs.", cta: "Open the admin console" },
            ].map((r) => (
              <Card key={r.title} className="flex flex-col transition-shadow hover:shadow-lift">
                <CardContent className="flex flex-1 flex-col p-6"><span className="inline-flex w-fit rounded-xl bg-slate-950 p-3 text-white"><r.icon className="h-6 w-6" aria-hidden /></span><h3 className="mt-4 font-display text-xl font-semibold">{r.title}</h3><p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{r.text}</p><Button asChild variant="outline" className="mt-5 w-fit"><Link to={r.to}>{r.cta} <ArrowRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button></CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-500">All three apps are live and share one sign-in — your account role decides which console you land in.</p>
        </div>
      </section>
      {/* Shelters strip */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="shelters-h">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="shelters-h" className="font-display text-3xl font-bold text-slate-900">Shelters with space, right now</h2><Button asChild variant="outline"><Link to="/citizen/shelters">Find shelters <ArrowRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button></div>
        {sheltersQ.loading ? <p className="mt-6 text-sm text-slate-500">Loading live shelter capacity…</p>
          : sheltersQ.error ? <p className="mt-6 text-sm text-slate-500">Live shelter data is unavailable right now — please sign in or try again shortly.</p>
          : sheltersWithSpace.length === 0 ? <p className="mt-6 text-sm text-slate-500">No shelters are currently listed. Sign in to see the full shelter directory.</p>
          : (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {sheltersWithSpace.map((s) => (
            <Card key={s.id}><CardContent className="p-5"><p className="font-display font-semibold">{s.name}</p><p className="mt-1 text-sm text-slate-600">{s.area} · {titleCase(s.status)}</p><p className="mt-3 text-sm"><strong>{s.available}</strong> of {s.capacity} places free</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-500" style={{ width: `${s.capacity ? (s.occupied / s.capacity) * 100 : 0}%` }} /></div></CardContent></Card>
          ))}
        </div>)}
      </section>
      {/* Disclaimer */}
      <section className="border-y border-amber-200 bg-amber-50" aria-labelledby="disclaimer-h">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start gap-3 px-4 py-6 sm:px-6">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div className="max-w-3xl">
            <h2 id="disclaimer-h" className="font-display text-base font-bold text-amber-900">Important — please read</h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">ResQFlow is an academic demonstration project. It is <strong>not connected to any government or official emergency service</strong>, and submitting an SOS or report here does not alert official responders. In a real emergency, call <strong>112</strong> (India) or your local emergency number first. External weather, earthquake and disaster information shown in the app comes from public sources (Open-Meteo, USGS, GDACS) and is not an official warning.</p>
          </div>
        </div>
      </section>
      {/* CTA */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4 py-14 sm:px-6">
          <div><h2 className="font-display text-3xl font-bold">When minutes matter, be already connected.</h2><p className="mt-2 text-slate-300">Create a free citizen account so responders can reach you faster when it counts.</p></div>
          <Button asChild size="lg"><Link to="/register">Create account <ArrowRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button>
        </div>
      </section>
    </div>
  );
}
