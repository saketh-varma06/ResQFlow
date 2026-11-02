import { useState } from "react";
import { Navigation, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { api, ApiError, type Envelope } from "@/lib/api";
import { titleCase, type ApiDispatchEntry, type ApiDispatchResult, type ApiRoute } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

/**
 * Nearest-unit dispatch (Stage C). Units are ranked by real road time from OSRM;
 * if the routing service is down the panel says so and shows straight-line distance
 * instead of pretending the estimates are road times.
 */
export function DispatchPanel({ kind, id, canAssign, onShowRoute, onAssigned }: {
  kind: "incidents" | "sos";
  id: string;
  canAssign: boolean;
  onShowRoute?: (route: ApiRoute | null) => void;
  onAssigned?: () => void;
}) {
  const dispatch = useApi(() => api<Envelope<ApiDispatchResult>>(`/api/${kind}/${id}/dispatch`), [id]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [activeRoute, setActiveRoute] = useState<string | null>(null);

  async function showRoute(entry: ApiDispatchEntry) {
    setError(""); setBusy(entry.profileId);
    try {
      const r = await api<Envelope<ApiRoute>>(`/api/${kind}/${id}/route?unit=${entry.profileId}`);
      setActiveRoute(entry.profileId);
      onShowRoute?.(r.data);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not load the route."); }
    finally { setBusy(""); }
  }
  async function assign(entry: ApiDispatchEntry) {
    setError(""); setBusy(entry.profileId);
    try {
      await api(`/api/${kind}/${id}/assign`, { method: "POST", body: JSON.stringify({ responderProfileId: entry.profileId }) });
      onAssigned?.();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Assignment failed."); }
    finally { setBusy(""); }
  }

  if (dispatch.loading) return <p className="text-sm text-muted-foreground">Ranking units by road time…</p>;
  if (dispatch.error) return <p className="text-sm text-muted-foreground">{dispatch.error.includes("no coordinates") ? "This report has no location pin, so road-time ranking is not available." : dispatch.error}</p>;
  const data = dispatch.data?.data;
  if (!data) return null;
  return (
    <div className="space-y-3 text-sm">
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 font-medium text-red-700">{error}</p>}
      <p className="text-muted-foreground">{data.source === "osrm"
        ? "Ranked by driving time (OSRM road network). The first unit is the fastest to reach the scene."
        : "Routing service unreachable — showing straight-line distances only. Treat these as rough estimates, not road times."}</p>
      <ol className="space-y-2">
        {data.ranked.map((e, i) => (
          <li key={e.profileId} className={`rounded-md border p-3 ${i === 0 ? "border-emerald-300 bg-emerald-50/60" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{i + 1}. {e.unitName}</span>
              <StatusBadge status={e.readiness} />
              {i === 0 && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">Fastest</span>}
              <span className="ml-auto font-semibold">{e.durationMinutes != null ? `~${Math.round(e.durationMinutes)} min` : `${e.straightLineKm} km away`}{e.distanceKm != null ? ` · ${e.distanceKm} km by road` : ""}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{titleCase(e.unitType)} · {e.base} · {e.members} members</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {onShowRoute && <Button size="sm" variant={activeRoute === e.profileId ? "default" : "outline"} disabled={busy === e.profileId} onClick={() => void showRoute(e)}><RouteIcon className="mr-1.5 h-4 w-4" aria-hidden /> {activeRoute === e.profileId ? "Route shown" : "Show route"}</Button>}
              {canAssign && <Button size="sm" disabled={busy === e.profileId} onClick={() => void assign(e)}><Navigation className="mr-1.5 h-4 w-4" aria-hidden /> Assign this unit</Button>}
            </div>
          </li>
        ))}
      </ol>
      {data.unranked.length > 0 && <p className="text-xs text-muted-foreground">Not ranked (no base coordinates): {data.unranked.map((u) => u.unitName).join(", ")}.</p>}
      {data.ranked.length === 0 && <p className="text-muted-foreground">No units have base coordinates yet — an admin can add them in Responder Management.</p>}
    </div>
  );
}
