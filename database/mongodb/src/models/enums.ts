/**
 * Enum value lists copied 1:1 from backend/prisma/schema.prisma.
 * Keep these in lockstep with the Prisma enums — the MongoDB validators use
 * exactly the same allowed values as PostgreSQL, so migrated data validates
 * and the two stores stay semantically identical until cutover.
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

/** Which entity a statusHistory entry belongs to (unifies the two Prisma history models). */
export const STATUS_HISTORY_ENTITY_TYPES = ["INCIDENT", "SOS"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type SosStatus = (typeof SOS_STATUSES)[number];
export type SosCategory = (typeof SOS_CATEGORIES)[number];
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];
export type ShelterStatus = (typeof SHELTER_STATUSES)[number];
export type AlertStatus = (typeof ALERT_STATUSES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type ResponderReadiness = (typeof RESPONDER_READINESS)[number];
export type AuditResult = (typeof AUDIT_RESULTS)[number];
export type StatusHistoryEntityType =
  (typeof STATUS_HISTORY_ENTITY_TYPES)[number];
