/**
 * Runtime enum objects + types with the same names the code previously
 * imported from the Prisma client package (e.g. `z.nativeEnum(UserRole)` and
 * `type UserRole`). Values come from models/enums so there is one source.
 */
import {
  USER_ROLES,
  USER_STATUSES,
  SEVERITIES,
  INCIDENT_TYPES,
  INCIDENT_STATUSES,
  SOS_STATUSES,
  SOS_CATEGORIES,
  PRIORITY_LEVELS,
  SHELTER_STATUSES,
  ALERT_STATUSES,
  NOTIFICATION_TYPES,
  ASSIGNMENT_STATUSES,
  RESPONDER_READINESS,
  AUDIT_RESULTS,
  VERIFICATION_STATUSES,
  VULNERABLE_GROUPS,
} from "../models/enums";

function enumObj<T extends readonly string[]>(values: T): { [K in T[number]]: K } {
  const out = {} as { [K in T[number]]: K };
  for (const v of values) (out as Record<string, string>)[v] = v;
  return out;
}

export const UserRole = enumObj(USER_ROLES);
export type UserRole = (typeof USER_ROLES)[number];
export const UserStatus = enumObj(USER_STATUSES);
export type UserStatus = (typeof USER_STATUSES)[number];
export const Severity = enumObj(SEVERITIES);
export type Severity = (typeof SEVERITIES)[number];
export const IncidentType = enumObj(INCIDENT_TYPES);
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export const IncidentStatus = enumObj(INCIDENT_STATUSES);
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export const SOSStatus = enumObj(SOS_STATUSES);
export type SOSStatus = (typeof SOS_STATUSES)[number];
export const SOSCategory = enumObj(SOS_CATEGORIES);
export type SOSCategory = (typeof SOS_CATEGORIES)[number];
export const PriorityLevel = enumObj(PRIORITY_LEVELS);
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];
export const ShelterStatus = enumObj(SHELTER_STATUSES);
export type ShelterStatus = (typeof SHELTER_STATUSES)[number];
export const AlertStatus = enumObj(ALERT_STATUSES);
export type AlertStatus = (typeof ALERT_STATUSES)[number];
export const NotificationType = enumObj(NOTIFICATION_TYPES);
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const AssignmentStatus = enumObj(ASSIGNMENT_STATUSES);
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export const ResponderReadiness = enumObj(RESPONDER_READINESS);
export type ResponderReadiness = (typeof RESPONDER_READINESS)[number];
export const AuditResult = enumObj(AUDIT_RESULTS);
export type AuditResult = (typeof AUDIT_RESULTS)[number];
export const VerificationStatus = enumObj(VERIFICATION_STATUSES);
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export const VulnerableGroup = enumObj(VULNERABLE_GROUPS);
export type VulnerableGroup = (typeof VULNERABLE_GROUPS)[number];
