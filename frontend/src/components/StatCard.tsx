import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
const tones = { red: "bg-red-100 text-red-700", amber: "bg-amber-100 text-amber-800", green: "bg-emerald-100 text-emerald-700", sky: "bg-sky-100 text-sky-700", slate: "bg-slate-200 text-slate-700" } as const;
export function StatCard({ label, value, sub, icon: Icon, tone = "slate" }: { label: string; value: string; sub?: string; icon: LucideIcon; tone?: keyof typeof tones }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 font-display text-3xl font-bold">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <span className={cn("rounded-lg p-2.5", tones[tone])}><Icon className="h-5 w-5" aria-hidden /></span>
      </CardContent>
    </Card>
  );
}
