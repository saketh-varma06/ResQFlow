/**
 * ResQFlow API client.
 * Session = httpOnly cookie set by the backend (never stored in JS).
 * CSRF = double-submit: the backend sets a readable `resqflow_csrf` cookie at login;
 * every mutating request echoes it in the `x-csrf-token` header.
 */
const API_BASE = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) { super(message); this.status = status; this.details = details; }
}

function csrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)resqflow_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = csrfToken();
    if (csrf) headers["x-csrf-token"] = csrf;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const msg = (json as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, (json as { details?: unknown } | null)?.details);
  }
  return json as T;
}

export interface Envelope<T> { data: T }
export interface ListEnvelope<T> { data: T[]; meta: { total: number; page: number; limit: number; pages: number } }
