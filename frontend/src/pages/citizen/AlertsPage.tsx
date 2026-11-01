import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SeverityBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type ListEnvelope } from "@/lib/api";
import { fmtDate, type ApiAlert } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

const FILTERS = ["ALL", "CRITICAL", "HIGH", "MODERATE", "LOW"] as const;
export default function AlertsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const alerts = useApi(() => api<ListEnvelope<ApiAlert>>("/api/alerts?limit=50"));
  const rows = alerts.data?.data.filter((a) => filter === "ALL" || a.severity === filter) ?? [];
  return (
    <div>
      <PageHeader title="Disaster alerts" description="Active official alerts from the backend. Expired and draft alerts are not shown to citizens." />
      <div className="mb-4 flex flex-wrap gap-2">{FILTERS.map((f) => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f === "ALL" ? "All severities" : f.charAt(0) + f.slice(1).toLowerCase()}</Button>)}</div>
      {alerts.loading ? <LoadingCards count={3} /> : alerts.error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{alerts.error}</p>
        : rows.length === 0 ? <EmptyState title="No active alerts" description="There are no active alerts at this severity right now." />
        : <div className="space-y-3">{rows.map((a) => (
          <Card key={a.id}><CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-2"><SeverityBadge severity={a.severity} /><span className="font-display font-bold">{a.title}</span>
              <span className="ml-auto text-xs text-muted-foreground">{a.area} · {fmtDate(a.issuedAt)} · {a.source}</span></div>
            <button type="button" className="mt-2 flex items-center gap-1 text-sm font-semibold text-red-700 hover:underline" aria-expanded={openId === a.id} onClick={() => setOpenId(openId === a.id ? null : a.id)}>
              Safety instructions <ChevronDown className={`h-4 w-4 transition ${openId === a.id ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {openId === a.id && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{a.instructions}</p>}
          </CardContent></Card>))}
        </div>}
    </div>
  );
}
