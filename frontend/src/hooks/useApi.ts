import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ref = useRef(fetcher);
  ref.current = fetcher;
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await ref.current()); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not load data. Is the backend running?"); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}
