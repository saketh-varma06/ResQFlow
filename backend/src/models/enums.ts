/**
 * Enum value lists copied 1:1 from the original Prisma schema.
 * The Mongoose schemas validate against exactly these values.
 */
export const USER_ROLES = ["CITIZEN", "RESPONDER", "ADMIN"] as const;
export const USER_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED"] as const;

export const SEVERITIES = ["CRITICAL", "HIGH", "MODERATE", "LOW"] as const;

export const INCIDENT_TYPES = [
  "FLOOD",
  "FIRE",
  "STORM",
  "LANDSLIDE",
  "INFRASTRUCTURE",
  "UTILITY",
  "MEDICAL",
  "HAZMAT",
  "OTHER",
] as const;

/** Shared workflow: SUBMITTED → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED */
export const INCIDENT_STATUSES = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

/** SOS adds citizen-initiated CANCELLED. */
export const SOS_STATUSES = [...INCIDENT_STATUSES, "CANCELLED"] as const;

export const SOS_CATEGORIES = [
  "FLOOD",
  "FIRE",
  "LANDSLIDE",
  "MEDICAL",
  "TRAPPED",
  "INFRASTRUCTURE",
  "OTHER",
] as const;

export const PRIORITY_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export const SHELTER_STATUSES = [
  "OPEN",
  "NEARLY_FULL",
  "FULL",
  "CLOSED",
] as const;

export const ALERT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
] as const;

export const NOTIFICATION_TYPES = [
  "ALERT",
  "INCIDENT_UPDATE",
  "SOS_UPDATE",
  "REQUEST_UPDATE",
  "SHELTER",
  "SYSTEM",
] as const;

export const ASSIGNMENT_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const RESPONDER_READINESS = [
  "AVAILABLE",
  "DEPLOYED",
  "STANDBY",
  "OFF_DUTY",
] as const;

export const AUDIT_RESULTS = ["SUCCESS", "DENIED", "WARNING"] as const;

/** Which entity a statusHistory entry belongs to (unifies the two former history tables). */
export const STATUS_HISTORY_ENTITY_TYPES = ["INCIDENT", "SOS"] as const;
