import { AlertTriangle, BellRing, ClipboardCheck, Home, Siren, X } from "lucide-react";
import { useRealtime, type Toast } from "@/context/RealtimeContext";

const icons = { sos: Siren, incident: ClipboardCheck, alert: AlertTriangle, shelter: Home, notification: BellRing, system: BellRing };
export default function RealtimeToasts() {
  const { toasts, dismiss, connected } = useRealtime();
  return (
    <>
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t: Toast) => {
          const Icon = icons[t.kind];
          return (
            <div key={t.id} className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-red-200 bg-white p-3 shadow-lift">
              <span className="rounded-lg bg-red-600 p-1.5 text-white"><Icon className="h-4 w-4" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">{t.title}</p>
                {t.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.body}</p>}
              </div>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="rounded p-0.5 hover:bg-slate-100"><X className="h-4 w-4" aria-hidden /></button>
            </div>
          );
        })}
      </div>
      <span className="sr-only" role="status">{connected ? "Realtime connected" : "Realtime disconnected"}</span>
    </>
  );
}
