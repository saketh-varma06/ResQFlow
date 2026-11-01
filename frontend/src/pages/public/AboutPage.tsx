import { Link } from "react-router-dom";
import { ArrowRight, BellRing, Building2, LifeBuoy, ShieldCheck, Siren, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-red-700">About the platform</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-slate-900">Why ResQFlow exists</h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">During a flood, fire or storm, help often exists — but it is fragmented. Citizens don't know where to ask, control rooms can't see the whole picture, and responders work from phone calls and paper. ResQFlow brings those pieces into one coordinated system.</p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {[
          { icon: Siren, title: "The problem", text: "Emergency information is scattered across calls, messages and spreadsheets. Requests get duplicated, shelters fill silently, and nobody can prove afterwards what was decided, when, and by whom." },
          { icon: LifeBuoy, title: "The approach", text: "One shared operational picture: citizens report and request, responders act from a prioritised queue, and administrators coordinate alerts, shelters and units — with every action written to an audit log." },
          { icon: Users, title: "Who it serves", text: "Citizens who need help or safety information; responder units — fire, medical, water rescue, utility and municipal crews; and district administrators who run the response." },
          { icon: ShieldCheck, title: "Principles", text: "Clarity under stress, accessibility by default, honest status at every step, and no dark patterns around safety information. In a life-threatening emergency, people are always told to call 112 first." },
        ].map((s) => (
          <Card key={s.title}><CardContent className="p-6"><span className="inline-flex rounded-xl bg-red-50 p-3 text-red-700"><s.icon className="h-6 w-6" aria-hidden /></span><h2 className="mt-4 font-display text-xl font-semibold">{s.title}</h2><p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.text}</p></CardContent></Card>
        ))}
      </div>
      <h2 className="mt-12 font-display text-2xl font-bold text-slate-900">How a request flows</h2>
      <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["1", "Citizen reports", "An SOS or incident report arrives with location, type and severity."], ["2", "Control verifies", "Administrators verify, merge duplicates and publish alerts if the public needs them."], ["3", "Unit responds", "The nearest suitable responder unit accepts, travels and updates status live."], ["4", "Everyone sees closure", "The citizen tracks progress, and the audit log keeps the full record."]].map(([n, t, d]) => (
          <li key={n} className="rounded-xl border bg-white p-5 shadow-card"><span className="font-display text-3xl font-extrabold text-red-600">{n}</span><p className="mt-2 font-display font-semibold">{t}</p><p className="mt-1 text-sm text-slate-600">{d}</p></li>
        ))}
      </ol>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild><Link to="/register">Create a citizen account <ArrowRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button>
        <Button asChild variant="outline"><Link to="/citizen/alerts"><BellRing className="mr-1 h-4 w-4" aria-hidden /> See current alerts (preview)</Link></Button>
        <Button asChild variant="outline"><Link to="/citizen/shelters"><Building2 className="mr-1 h-4 w-4" aria-hidden /> Find a shelter</Link></Button>
      </div>
      <p className="mt-8 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">Build note: this is the Phase 1 interface. Screens use clearly labelled temporary preview data; accounts, live data and notifications arrive with the backend in a later phase.</p>
    </div>
  );
}
