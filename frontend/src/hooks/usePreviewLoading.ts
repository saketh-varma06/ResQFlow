import { useEffect, useState } from "react";
/** Simulates a short data-loading state so loading UI can be previewed. Data itself is local preview data. */
export function usePreviewLoading(ms = 450) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), ms); return () => clearTimeout(t); }, [ms]);
  return loading;
}
