import type { PriorityLevel, Severity } from "@prisma/client";

/**
 * Explainable, rule-based priority scoring for emergency requests and incidents.
 *
 * IMPORTANT: this is a simple operational sorting aid designed for this platform.
 * It is NOT a medically validated or officially approved emergency triage algorithm,
 * and it must never override human dispatcher judgement.
 *
 * Score is 0–100, built from transparent parts; every part that contributed is
 * returned in `reasons` so a dispatcher can see exactly why a score was given:
 *   base        severity (incidents) or category (SOS, which has no severity field)
 *   category    small bump for time-critical incident types
 *   people      scaled by people affected
 *   injuries    +4 per reported injury, capped
 *   trapped     flat bonus when people are reported trapped
 *   waiting     grows slowly with time since submission, capped
 */
export interface PriorityInput {
  severity?: Severity | null;
  category: string;
  peopleAffected?: number;
  injuriesReported?: number;
  trapped?: boolean;
  submittedAt: Date;
  now?: Date;
}
export interface PriorityResult { score: number; level: PriorityLevel; reasons: string[] }

const SEVERITY_POINTS: Record<string, number> = { CRITICAL: 40, HIGH: 30, MODERATE: 18, LOW: 8 };
const CATEGORY_BASE: Record<string, number> = { MEDICAL: 35, TRAPPED: 35, FIRE: 32, FLOOD: 28, LANDSLIDE: 28, STORM: 22, HAZMAT: 26, INFRASTRUCTURE: 15, UTILITY: 10, OTHER: 10 };
const CATEGORY_LABEL: Record<string, string> = { MEDICAL: "Medical emergency", TRAPPED: "Trapped or stranded", FIRE: "Fire", FLOOD: "Flood", LANDSLIDE: "Landslide", STORM: "Storm", HAZMAT: "Hazardous materials", INFRASTRUCTURE: "Infrastructure damage", UTILITY: "Utility failure", OTHER: "Other" };
const INCIDENT_TYPE_BUMP: Record<string, number> = { MEDICAL: 6, FIRE: 4, FLOOD: 4, LANDSLIDE: 4, HAZMAT: 4 };

export function peoplePoints(people: number): number {
  if (people >= 100) return 20;
  if (people >= 50) return 16;
  if (people >= 20) return 12;
  if (people >= 10) return 8;
  if (people >= 5) return 5;
  if (people >= 2) return 3;
  if (people >= 1) return 1;
  return 0;
}

export function computePriority(input: PriorityInput): PriorityResult {
  const reasons: string[] = [];
  let score = 0;
  if (input.severity) {
    const pts = SEVERITY_POINTS[input.severity] ?? 8;
    score += pts;
    reasons.push(`Severity ${input.severity.toLowerCase()} (+${pts})`);
    const bump = INCIDENT_TYPE_BUMP[input.category] ?? 0;
    if (bump > 0) { score += bump; reasons.push(`${CATEGORY_LABEL[input.category] ?? input.category} is time-critical (+${bump})`); }
  } else {
    const pts = CATEGORY_BASE[input.category] ?? 10;
    score += pts;
    reasons.push(`Category: ${CATEGORY_LABEL[input.category] ?? input.category} (+${pts})`);
  }
  const people = input.peopleAffected ?? 0;
  const pp = peoplePoints(people);
  if (pp > 0) { score += pp; reasons.push(`${people} ${people === 1 ? "person" : "people"} affected (+${pp})`); }
  const injuries = input.injuriesReported ?? 0;
  if (injuries > 0) {
    const pts = Math.min(20, injuries * 4);
    score += pts;
    reasons.push(`${injuries} reported ${injuries === 1 ? "injury" : "injuries"} (+${pts})`);
  }
  if (input.trapped) { score += 15; reasons.push("People reported trapped (+15)"); }
  const now = input.now ?? new Date();
  const minutes = Math.max(0, Math.floor((now.getTime() - input.submittedAt.getTime()) / 60000));
  const waitPts = Math.min(10, Math.floor(minutes / 15));
  if (waitPts > 0) {
    const label = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
    score += waitPts;
    reasons.push(`Waiting ${label} (+${waitPts})`);
  }
  score = Math.min(100, score);
  const level: PriorityLevel = score >= 70 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
  return { score, level, reasons };
}
