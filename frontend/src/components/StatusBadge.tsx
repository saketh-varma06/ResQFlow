import { Badge } from "@/components/ui/badge";
const severityVariant = { critical: "critical", high: "warning", moderate: "warning", low: "info" } as const;
const severityLabel = { critical: "Critical", high: "High", moderate: "Moderate", low: "Low" } as const;
export function SeverityBadge({ severity }: { severity: string }) {
  const key = severity.toLowerCase() as keyof typeof severityLabel;
  return <Badge variant={severityVariant[key] ?? "secondary"}>{severityLabel[key] ?? severity}</Badge>;
}
export function PriorityBadge({ level, score }: { level: string; score?: number }) {
  const key = level.toLowerCase();
  const cls = key === "critical" ? "bg-red-600 text-white border-red-700" : key === "high" ? "bg-red-100 text-red-800 border-red-200" : key === "medium" ? "bg-amber-100 text-amber-900 border-amber-200" : "bg-slate-100 text-slate-700 border-slate-200";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>{key.toUpperCase()}{score !== undefined ? ` · ${score}` : ""}</span>;
}
const statusStyles: Record<string, string> = {
  submitted: "bg-sky-100 text-sky-800 border-sky-200", reported: "bg-sky-100 text-sky-800 border-sky-200", verified: "bg-violet-100 text-violet-800 border-violet-200",
  assigned: "bg-amber-100 text-amber-900 border-amber-200", "in-progress": "bg-orange-100 text-orange-900 border-orange-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200", closed: "bg-slate-200 text-slate-700 border-slate-300",
  open: "bg-emerald-100 text-emerald-800 border-emerald-200", "nearly-full": "bg-amber-100 text-amber-900 border-amber-200",
  full: "bg-red-100 text-red-800 border-red-200", active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  expired: "bg-slate-200 text-slate-600 border-slate-300", draft: "bg-slate-100 text-slate-600 border-slate-200",
  cancelled: "bg-slate-200 text-slate-600 border-slate-300", pending: "bg-amber-100 text-amber-900 border-amber-200",
  accepted: "bg-sky-100 text-sky-800 border-sky-200", completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  suspended: "bg-red-100 text-red-800 border-red-200", available: "bg-emerald-100 text-emerald-800 border-emerald-200",
  deployed: "bg-orange-100 text-orange-900 border-orange-200", standby: "bg-sky-100 text-sky-800 border-sky-200",
  "off-duty": "bg-slate-200 text-slate-600 border-slate-300", new: "bg-red-100 text-red-800 border-red-200",
  acknowledged: "bg-amber-100 text-amber-900 border-amber-200", "team-assigned": "bg-sky-100 text-sky-800 border-sky-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200", denied: "bg-red-100 text-red-800 border-red-200",
  warning: "bg-amber-100 text-amber-900 border-amber-200",
};
export function StatusBadge({ status }: { status: string }) {
  const norm = status.toLowerCase().replace(/_/g, "-");
  const cls = statusStyles[norm] ?? "bg-secondary text-secondary-foreground";
  const label = norm.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap ${cls}`}>{label}</span>;
}
export function VerificationBadge({ status }: { status?: string | null }) {
  if (!status || status === "UNVERIFIED") return <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-slate-500">Unverified</span>;
  if (status === "VERIFIED") return <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-emerald-700">Verified</span>;
  return <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-red-700">Duplicate</span>;
}
