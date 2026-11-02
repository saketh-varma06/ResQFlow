import { useState } from "react";
import { Copy, Download, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type Envelope } from "@/lib/api";
import { fmtDate, titleCase, type ApiSitrep } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

/** One-click Situation Report (Stage F) — every figure is a live database count. */
export function SitrepPanel() {
  const sitrep = useApi(() => api<Envelope<ApiSitrep>>("/api/analytics/sitrep"));
  const [copied, setCopied] = useState(false);
  const r = sitrep.data?.data;

  function buildText(): string {
    if (!r) return "";
    return [
      `RESQFLOW SITUATION REPORT — ${new Date(r.generatedAt).toUTCString()}`,
      `(Academic demonstration platform — live counts from the ResQFlow database.)`,
      `Open incidents: ${r.overview.openIncidents} · Open SOS: ${r.overview.openSos} · Pending SOS: ${r.overview.pendingSos}${r.overview.oldestPendingSosMinutes != null ? ` (oldest ${r.overview.oldestPendingSosMinutes} min)` : ""}`,
      `Last 24h — new ${r.last24h.newIncidents} incidents / ${r.last24h.newSos} SOS · resolved ${r.last24h.resolvedIncidents} / ${r.last24h.resolvedSos}`,
      `Open by severity: ${r.openBySeverity.map((s) => `${s.severity} ${s.count}`).join(", ") || "none"} · Busiest: ${r.busiestAreas.map((a) => `${a.area} (${a.openReports})`).join(", ") || "—"}`,
      `Shelters: ${r.shelters.occupied}/${r.shelters.capacity} occupied (${r.shelters.utilizationPercent}%)${r.shelters.fullShelters.length ? ` · Full: ${r.shelters.fullShelters.join(", ")}` : ""}`,
      `Top priorities:`,
      ...r.topPriorities.map((p, i) => `${i + 1}. [${p.kind}] ${p.title} — ${p.area} · ${p.priorityScore} (${p.priorityLevel}) · ${p.status}`),
      `Active alerts: ${r.activeAlertTitles.join("; ") || "none"}`,
    ].join("\n");
  }
  async function copyText() {
    if (!r) return;
    await navigator.clipboard.writeText(buildText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  function download() {
    if (!r) return;
    const text = buildText();
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = `resqflow-sitrep-${r.generatedAt.slice(0, 10)}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2"><FileBarChart className="h-5 w-5 text-red-700" aria-hidden /> Situation report</CardTitle>
        <span className="text-sm text-muted-foreground">Live counts from the database — nothing estimated</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void sitrep.reload()}>Regenerate</Button>
          <Button size="sm" variant="outline" onClick={() => void copyText()}><Copy className="mr-1.5 h-4 w-4" aria-hidden /> {copied ? "Copied" : "Copy text"}</Button>
          <Button size="sm" variant="outline" onClick={download}><Download className="mr-1.5 h-4 w-4" aria-hidden /> .txt</Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {sitrep.loading ? <p className="text-muted-foreground">Generating…</p> : sitrep.error ? <p className="text-red-700">{sitrep.error}</p> : r && (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="font-semibold">Overview · {fmtDate(r.generatedAt)}</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>Open incidents: <strong className="text-foreground">{r.overview.openIncidents}</strong></li>
                <li>Open SOS: <strong className="text-foreground">{r.overview.openSos}</strong> ({r.overview.pendingSos} unacknowledged{r.overview.oldestPendingSosMinutes != null ? `, oldest ${r.overview.oldestPendingSosMinutes} min` : ""})</li>
                <li>Active alerts: <strong className="text-foreground">{r.overview.activeAlerts}</strong></li>
                <li>Last 24h: {r.last24h.newIncidents} new incidents, {r.last24h.newSos} new SOS · {r.last24h.resolvedIncidents + r.last24h.resolvedSos} resolved</li>
              </ul>
              <p className="mt-2 font-semibold">Caseload</p>
              <p className="text-muted-foreground">{r.openBySeverity.map((s) => `${titleCase(s.severity)} ${s.count}`).join(" · ") || "No open reports"}</p>
              <p className="text-muted-foreground">Busiest: {r.busiestAreas.map((a) => `${a.area} (${a.openReports})`).join(", ") || "—"}</p>
            </div>
            <div>
              <p className="font-semibold">Highest priority open</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                {r.topPriorities.map((p) => <li key={`${p.kind}-${p.title}`}>[{p.kind}] {p.title} <span className="text-muted-foreground">— {p.area} · {p.priorityScore} ({titleCase(p.priorityLevel)})</span></li>)}
                {r.topPriorities.length === 0 && <li className="list-none text-muted-foreground">None.</li>}
              </ol>
            </div>
            <div>
              <p className="font-semibold">Shelters</p>
              <p className="mt-1 text-muted-foreground">{r.shelters.occupied} of {r.shelters.capacity} places occupied across {r.shelters.count} shelters ({r.shelters.utilizationPercent}%).</p>
              {r.shelters.fullShelters.length > 0 && <p className="text-red-700">Full: {r.shelters.fullShelters.join(", ")}</p>}
              <p className="mt-2 font-semibold">Active alerts</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">{r.activeAlertTitles.map((t) => <li key={t}>{t}</li>)}{r.activeAlertTitles.length === 0 && <li>None.</li>}</ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
