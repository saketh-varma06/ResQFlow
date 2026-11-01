import { ApiError } from "./ApiError";

/** The single status workflow for incidents and SOS requests (CANCELLED is SOS-only, citizen-initiated). */
export const WORKFLOW_ORDER = ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export const TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["ACKNOWLEDGED", "CANCELLED", "CLOSED"],
  ACKNOWLEDGED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "ACKNOWLEDGED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};
export function allowedTransitions(from: string): string[] { return TRANSITIONS[from] ?? []; }
export function assertTransition(from: string, to: string) {
  if (from === to) return;
  const allowed = allowedTransitions(from);
  if (!allowed.includes(to)) {
    throw ApiError.badRequest(`Invalid status transition ${from} → ${to}. Allowed from ${from}: ${allowed.length ? allowed.join(", ") : "none — this record is closed"}.`);
  }
}
