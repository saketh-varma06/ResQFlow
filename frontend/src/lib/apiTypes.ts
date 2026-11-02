export interface ApiUserRef { id: string; name: string; email?: string; role?: string; phone?: string | null }
export interface ApiHistoryEntry { id: string; fromStatus: string | null; toStatus: string; note?: string | null; createdAt: string; changedBy?: { id: string; name: string; role: string } }
export interface ApiAssignment { id: string; status: string; notes?: string | null; assignedAt: string; responderProfile?: { id: string; unitName: string; unitType: string; user?: ApiUserRef } }
export interface ApiIncident {
  id: string; title: string; type: string; severity: string; status: string; description: string;
  location: string; area: string; latitude?: number | null; longitude?: number | null;
  peopleAffected: number; injuriesReported: number; trapped: boolean;
  priorityScore: number; priorityLevel: string; priorityReasons: string[];
  verificationStatus?: string; duplicateOfId?: string | null; vulnerableGroups?: string[];
  reporterId: string; reporter?: ApiUserRef; assignments?: ApiAssignment[]; statusHistory?: ApiHistoryEntry[];
  createdAt: string; updatedAt: string;
}
export interface ApiSos {
  id: string; citizenId: string; citizen?: ApiUserRef; need: string; category: string; people: number;
  injuriesReported: number; trapped: boolean; location: string; area?: string | null;
  latitude?: number | null; longitude?: number | null; details?: string | null; phone?: string | null;
  status: string; priorityScore: number; priorityLevel: string; priorityReasons: string[];
  verificationStatus?: string; duplicateOfId?: string | null; vulnerableGroups?: string[];
  responderProfile?: { id: string; unitName: string; unitType: string; user?: ApiUserRef } | null;
  statusHistory?: ApiHistoryEntry[]; createdAt: string; updatedAt: string;
}
export const VULNERABLE_GROUPS = [
  { value: "ELDERLY", label: "Elderly people" }, { value: "CHILDREN", label: "Children" },
  { value: "DISABILITY", label: "People with disabilities" }, { value: "MEDICAL_DEPENDENCE", label: "Dependent on medical equipment / medication" },
  { value: "PREGNANT", label: "Pregnant people" },
] as const;
export interface ApiDuplicateCandidate { id: string; title?: string; need?: string; location: string; area?: string | null; status: string; priorityLevel: string; verificationStatus: string; createdAt: string; matchScore: number; matchReasons: string[] }
export interface ApiAlert { id: string; title: string; type: string; severity: string; area: string; instructions: string; source: string; status: string; reach: number; issuedAt: string; expiresAt?: string | null; headline?: string; capCategory?: string; capUrgency?: string; capCertainty?: string; centerLat?: number | null; centerLng?: number | null; radiusKm?: number | null }
export interface ApiAlertSubscription { id: string; mode: string; area?: string | null; centerLat?: number | null; centerLng?: number | null; radiusKm?: number | null; minSeverity?: string | null; createdAt: string }
export const CAP_CATEGORIES = ["Geo", "Met", "Safety", "Security", "Rescue", "Fire", "Health", "Env", "Transport", "Infra", "CBRNE", "Other"] as const;
export const CAP_URGENCIES = ["Immediate", "Expected", "Future", "Past", "Unknown"] as const;
export const CAP_CERTAINTIES = ["Observed", "Likely", "Possible", "Unlikely", "Unknown"] as const;
export interface ApiShelter { id: string; name: string; address: string; area: string; capacity: number; occupied: number; available: number; facilities: string[]; accessibility?: string | null; contact?: string | null; latitude?: number | null; longitude?: number | null; status: string; createdAt: string; updatedAt: string }
export interface ApiPledge { id: string; needId: string; shelterId: string; donorId: string; donorName: string; quantity: number; status: string; note?: string | null; createdAt: string }
export interface ApiShelterNeed { id: string; shelterId: string; item: string; category: string; quantityNeeded: number; quantityPledged: number; remaining: number; unit: string; status: string; notes?: string | null; createdAt: string; pledges?: ApiPledge[] }
export interface ApiMinimumNeeds { shelter: { id: string; name: string; capacity: number; occupied: number }; people: number; days: number; items: { key: string; label: string; unit: string; perDay: number | null; oneTime: number | null; totalForPeriod: number; basis: string }[]; assumptions: string[] }
export const NEED_CATEGORIES = ["FOOD", "WATER", "CLOTHING", "MEDICAL", "HYGIENE", "SHELTER_SUPPLIES", "OTHER"] as const;
export interface ApiChecklist { category: string; items: { key: string; label: string; checked: boolean }[]; completedCount: number; totalCount: number; updatedBy?: { name: string; role: string } | null; updatedAt?: string | null }
export interface ApiFieldReport { id: string; situation: string; peopleCount?: number | null; injuriesCount?: number | null; needsSummary?: string | null; risks?: string | null; createdAt: string; author?: ApiUserRef | null }
export interface ApiMissingPerson { id: string; fullName: string; ageApprox?: number | null; gender?: string | null; description?: string | null; lastSeenLocation: string; area?: string | null; latitude?: number | null; longitude?: number | null; lastSeenAt?: string | null; circumstances?: string | null; reporterId: string; reporterRelationship: string; reporterPhone: string; status: string; resolutionNote?: string | null; createdAt: string; updatedAt: string; reporter?: ApiUserRef & { email?: string } }
export const MISSING_PERSON_STATUSES = ["REPORTED", "SEARCHING", "FOUND_ALIVE", "FOUND_DECEASED", "CLOSED"] as const;
export interface ApiDonation { id: string; donorId: string; donorName: string; amount: number; currency: string; targetType: string; targetId?: string | null; targetLabel: string; message?: string | null; paymentRef?: string | null; anonymous: boolean; status: string; createdAt: string; updatedAt: string }
export interface ApiDonationSummary { currency: string; receivedTotal: number; receivedCount: number; donorCount: number; pledgedTotal: number; pledgedCount: number; byTarget: { targetLabel: string; total: number; count: number }[]; recentReceived: { id: string; donorName: string; amount: number; targetLabel: string; at: string }[]; note: string }
export interface ApiNotification { id: string; title: string; body: string; type: string; isRead: boolean; createdAt: string; relatedEntityType?: string | null; relatedEntityId?: string | null }
export interface ApiResponderProfile { id: string; userId: string; unitName: string; unitType: string; base: string; baseLat?: number | null; baseLng?: number | null; members: number; readiness: string; rating?: number | null; serviceArea?: string | null; user?: ApiUserRef }
export interface ApiDispatchEntry { profileId: string; unitName: string; unitType: string; base: string; baseLat: number; baseLng: number; readiness: string; members: number; durationMinutes: number | null; distanceKm: number | null; straightLineKm: number }
export interface ApiDispatchResult { target: { latitude: number; longitude: number }; source: string; ranked: ApiDispatchEntry[]; unranked: { profileId: string; unitName: string; reason: string }[]; generatedAt: string }
export interface ApiRoute { profileId: string; unitName: string; durationMinutes: number; distanceKm: number; geometry: { type: "LineString"; coordinates: [number, number][] }; source: string }
export const SOS_CATEGORIES = [
  { value: "FLOOD", label: "Flood" }, { value: "FIRE", label: "Fire" }, { value: "LANDSLIDE", label: "Landslide" },
  { value: "MEDICAL", label: "Medical emergency" }, { value: "TRAPPED", label: "Trapped or stranded" },
  { value: "INFRASTRUCTURE", label: "Infrastructure damage" }, { value: "OTHER", label: "Other" },
] as const;
export const INCIDENT_TYPES = ["FLOOD", "FIRE", "STORM", "LANDSLIDE", "INFRASTRUCTURE", "UTILITY", "MEDICAL", "HAZMAT", "OTHER"] as const;
export const WORKFLOW = ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export const NEXT_STATUSES: Record<string, string[]> = { SUBMITTED: ["ACKNOWLEDGED", "CLOSED"], ACKNOWLEDGED: ["ASSIGNED"], ASSIGNED: ["IN_PROGRESS"], IN_PROGRESS: ["RESOLVED"], RESOLVED: ["CLOSED"], CLOSED: [], CANCELLED: [] };
export function fmtDate(iso: string) { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
export function titleCase(s: string) { return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export interface ExtSource<T> { source: string; sourceUrl: string; fetchedAt: string; stale: boolean; status: "ok" | "unavailable"; error?: string; data: T | null }
export interface ExtWeather { latitude: number; longitude: number; timezone: string; temperatureC: number; humidityPct: number; precipitationMm: number; rainMm: number; weatherCode: number; condition: string; windKph: number; windGustsKph: number; forecast: { date: string; precipitationMm: number; precipitationProbabilityPct: number | null }[] }
export interface ExtQuake { id: string; magnitude: number; place: string; time: string; depthKm: number; latitude: number; longitude: number; tsunami: boolean; url: string }
export interface ExtGdacs { title: string; description: string; link: string; publishedAt: string; alertLevel: string; eventType: string; indiaRelated: boolean }
export interface ExtEonet { id: string; title: string; categories: string[]; latitude: number; longitude: number; date: string; link: string }
export interface ExtFloodWatch { name: string; latitude: number; longitude: number; dischargeToday: number; maxDischarge7d: number; trend: string; unit: string }
export interface ExtOverview { weather: ExtSource<ExtWeather>; earthquakes: ExtSource<ExtQuake[]>; gdacs: ExtSource<ExtGdacs[]>; eonet?: ExtSource<ExtEonet[]>; flood?: ExtSource<ExtFloodWatch[]>; generatedAt: string }
export interface ApiSitrep { generatedAt: string; windowHours: number; overview: { openIncidents: number; openSos: number; pendingSos: number; oldestPendingSosMinutes: number | null; activeAlerts: number }; last24h: { newIncidents: number; newSos: number; resolvedIncidents: number; resolvedSos: number }; openBySeverity: { severity: string; count: number }[]; openByType: { type: string; count: number }[]; busiestAreas: { area: string; openReports: number }[]; shelters: { count: number; capacity: number; occupied: number; utilizationPercent: number; fullShelters: string[] }; activeAlertTitles: string[]; donations?: { receivedTotal: number; receivedCount: number; pledgedTotal: number; pledgedCount: number }; topPriorities: { kind: string; title: string; area: string; priorityScore: number; priorityLevel: string; status: string }[] }
export interface ApiReplayEvent { at: string; kind: string; entityType: string; entityId: string; title: string; detail: string; actorEmail?: string; latitude?: number | null; longitude?: number | null }
export interface ApiReplay { events: ApiReplayEvent[]; from: string; to: string; truncated: boolean }

export interface AnalyticsOverview {
  users: { total: number; byRole: Record<string, number> };
  incidents: { total: number; active: number; byStatus: Record<string, number>; bySeverity: Record<string, number>; byType: Record<string, number>; trends14Days: { day: string; incidents: number; incidentsResolved: number; sos: number }[] };
  sos: { total: number; byStatus: Record<string, number>; pending: number; oldestPendingMinutes: number | null };
  shelters: { count: number; totalCapacity: number; totalOccupied: number; utilizationPercent: number; perShelter: { id: string; name: string; area: string; capacity: number; occupied: number; available: number; utilizationPercent: number; status: string }[] };
  alerts: { active: number };
  assignments: { total: number };
  responderWorkload: { profileId: string; unitName: string; unitType: string; readiness: string; members: number; activeAssignments: number; completedAssignments: number; activeSos: number; resolvedSos: number }[];
  response: { avgAcknowledgementMinutes: { incidents: number | null; sos: number | null }; avgResolutionMinutes: { incidents: number | null; sos: number | null }; resolvedCount: number; avgResolutionHours: number | null };
  generatedAt: string;
}
export interface ApiUser { id: string; email: string; phone?: string | null; name: string; role: string; status: string; area?: string | null; address?: string | null; createdAt: string; responderProfile?: { id: string; unitName: string } | null }
export interface ApiAudit { id: string; actorEmail?: string | null; action: string; targetType: string; targetId?: string | null; result: string; ipAddress?: string | null; details?: unknown; createdAt: string }

export interface GeoPlace { id: number; name: string; admin1?: string; country?: string; latitude: number; longitude: number; population?: number }
export interface GeocodeResult { data: GeoPlace[] | null; source: string; sourceUrl: string; fetchedAt: string; stale: boolean; status: string }
