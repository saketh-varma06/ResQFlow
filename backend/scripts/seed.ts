/**
 * ResQFlow demo seed — LOCAL DEVELOPMENT ONLY.
 * Demo accounts (passwords are public demo credentials for a local database, never for production):
 *   admin@resqflow.local     / Admin@12345     (ADMIN)
 *   citizen@resqflow.local   / Citizen@12345   (CITIZEN)
 *   responder@resqflow.local / Responder@12345 (RESPONDER, Unit R-12 River Rescue)
 *   fire@resqflow.local      / Responder@12345 (RESPONDER, Unit F-03 Fire & Rescue)
 * Re-running the seed resets the demo tables to a clean state.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectMongo, disconnectMongo } from "../src/db/mongo";
import {
  AlertModel,
  AssignmentModel,
  AuditLogModel,
  IncidentModel,
  NotificationModel,
  ResponderModel,
  ShelterModel,
  SosRequestModel,
  StatusHistoryModel,
  UserModel,
} from "../src/models";
import { computePriority } from "../src/utils/priority";

const hash = (pw: string) => bcrypt.hash(pw, 12);

async function main() {
  await connectMongo();
  // Clean slate (FK-safe order)
  await AuditLogModel.deleteMany({});
  await NotificationModel.deleteMany({});
  await StatusHistoryModel.deleteMany({});
  await AssignmentModel.deleteMany({});
  await SosRequestModel.deleteMany({});
  await IncidentModel.deleteMany({});
  await AlertModel.deleteMany({});
  await ShelterModel.deleteMany({});
  await ResponderModel.deleteMany({});
  await UserModel.deleteMany({});

  const admin = await UserModel.create({ name: "Sana Iqbal", email: "admin@resqflow.local", phone: "+919800000001", passwordHash: await hash("Admin@12345"), role: "ADMIN", status: "ACTIVE", area: "HQ" });
  const citizen = await UserModel.create({ name: "Ananya Sharma", email: "citizen@resqflow.local", phone: "+919800000002", passwordHash: await hash("Citizen@12345"), role: "CITIZEN", status: "ACTIVE", area: "North District", address: "House 42, Riverbank Road, Sector 7", bloodGroup: "O+", medicalNotes: "Asthma — carries inhaler" });
  const citizen2 = await UserModel.create({ name: "Rohit Verma", email: "rohit@resqflow.local", phone: "+919800000003", passwordHash: await hash("Citizen@12345"), role: "CITIZEN", status: "ACTIVE", area: "South District" });
  const responder = await UserModel.create({ name: "Kiran Bedi", email: "responder@resqflow.local", phone: "+919800000004", passwordHash: await hash("Responder@12345"), role: "RESPONDER", status: "ACTIVE", area: "North District" });
  const fireResponder = await UserModel.create({ name: "Dev Patel", email: "fire@resqflow.local", phone: "+919800000005", passwordHash: await hash("Responder@12345"), role: "RESPONDER", status: "ACTIVE", area: "Central District" });

  const riverUnit = await ResponderModel.create({ userId: responder.id, unitName: "River Rescue 12", unitType: "Water rescue", base: "North District Station", members: 8, readiness: "DEPLOYED", rating: 4.9, serviceArea: "North District" });
  const fireUnit = await ResponderModel.create({ userId: fireResponder.id, unitName: "Fire & Rescue 3", unitType: "Fire", base: "Central Fire Station", members: 11, readiness: "DEPLOYED", rating: 4.8, serviceArea: "Central District" });
  const shelters = await Promise.all([
    ShelterModel.create({ name: "North District Community Hall", address: "14 Civic Centre Road", area: "North District", capacity: 500, occupied: 312, facilities: ["Beds", "Food", "Medical desk", "Drinking water", "Charging points"], accessibility: "Step-free entrance, accessible toilets, ground-floor beds", contact: "+91 98000 00210", latitude: 28.638, longitude: 77.222, status: "OPEN", createdById: admin.id }),
    ShelterModel.create({ name: "Riverside School Gymnasium", address: "Riverside School, Bank Colony", area: "North District", capacity: 300, occupied: 287, facilities: ["Beds", "Food", "Child care", "First aid"], accessibility: "Ramp access; accessible toilet on ground floor", contact: "+91 98000 00431", latitude: 28.629, longitude: 77.226, status: "NEARLY_FULL", createdById: admin.id }),
    ShelterModel.create({ name: "Central Sports Complex", address: "Stadium Road", area: "Central District", capacity: 1200, occupied: 640, facilities: ["Beds", "Food", "Medical desk", "Showers", "Pet area"], accessibility: "Fully step-free, lifts, accessible toilets and showers", contact: "+91 98000 00876", latitude: 28.618, longitude: 77.212, status: "OPEN", createdById: admin.id }),
    ShelterModel.create({ name: "East District Relief Camp", address: "Fairground, East District", area: "East District", capacity: 800, occupied: 800, facilities: ["Tents", "Food", "Drinking water"], accessibility: "Ground-level tents; no accessible toilets yet", contact: "+91 98000 00102", latitude: 28.608, longitude: 77.24, status: "FULL", createdById: admin.id }),
  ]);

  const flood = await IncidentModel.create({ title: "Riverbank flooding — Sector 7", type: "FLOOD", severity: "CRITICAL", status: "IN_PROGRESS", description: "Water level rising after overnight rainfall. Several ground-floor homes inundated; evacuation support requested for two streets.", location: "Riverbank Road, Sector 7", area: "North District", latitude: 28.632, longitude: 77.219, peopleAffected: 340, injuriesReported: 2, trapped: true, reporterId: citizen.id });
  const fire = await IncidentModel.create({ title: "Apartment fire — Block C", type: "FIRE", severity: "CRITICAL", status: "ASSIGNED", description: "Fire reported on the 4th floor. Building evacuation under way; one stairwell reported smoke-logged.", location: "Block C, Lakeview Apartments", area: "Central District", latitude: 28.621, longitude: 77.208, peopleAffected: 85, reporterId: citizen2.id });
  const road = await IncidentModel.create({ title: "Road collapse after heavy rain", type: "INFRASTRUCTURE", severity: "HIGH", status: "ACKNOWLEDGED", description: "A section of the underpass approach road has subsided. Road closed in both directions; diversion in place.", location: "Ring Road underpass", area: "East District", latitude: 28.61, longitude: 77.235, peopleAffected: 1200, reporterId: citizen.id });
  const trees = await IncidentModel.create({ title: "Fallen trees blocking arterial road", type: "STORM", severity: "MODERATE", status: "RESOLVED", description: "Three trees down across two lanes after the storm. Road cleared and reopened.", location: "MG Avenue, km 4", area: "South District", latitude: 28.598, longitude: 77.224, peopleAffected: 150, reporterId: citizen2.id });
  await IncidentModel.create({ title: "Minor landslip — hillside path", type: "LANDSLIDE", severity: "LOW", status: "SUBMITTED", description: "Small debris slide blocking a walking path. No injuries reported; path cordoned off.", location: "Hillside walking path", area: "North District", latitude: 28.645, longitude: 77.23, peopleAffected: 12, reporterId: citizen.id });

  for (const inc of await IncidentModel.find()) {
    const pr = computePriority({ severity: inc.severity, category: inc.type, peopleAffected: inc.peopleAffected, injuriesReported: inc.injuriesReported, trapped: inc.trapped, submittedAt: inc.createdAt, now: inc.createdAt });
    await IncidentModel.updateOne({ _id: inc.id }, { $set: { priorityScore: pr.score, priorityLevel: pr.level, priorityReasons: pr.reasons } });
  }

  for (const [incident, to, by, note] of [
    [flood, "SUBMITTED", citizen.id, "Incident reported"], [flood, "ACKNOWLEDGED", admin.id, "Acknowledged by district control"], [flood, "ASSIGNED", admin.id, "Assigned to River Rescue 12"], [flood, "IN_PROGRESS", responder.id, "Unit on site"],
    [fire, "SUBMITTED", citizen2.id, "Incident reported"], [fire, "ASSIGNED", admin.id, "Assigned to Fire & Rescue 3"],
    [road, "SUBMITTED", citizen.id, "Incident reported"], [road, "ACKNOWLEDGED", admin.id, "Acknowledged by traffic control"],
    [trees, "SUBMITTED", citizen2.id, "Incident reported"], [trees, "RESOLVED", responder.id, "Road cleared and reopened"],
  ] as const) {
    await StatusHistoryModel.create({ entityType: "INCIDENT", entityId: incident.id, toStatus: to, changedById: by, note });
  }

  await AssignmentModel.create({ incidentId: flood.id, responderProfileId: riverUnit.id, assignedById: admin.id, status: "ACCEPTED", respondedAt: new Date(), notes: "Boat team + evacuation support" });
  await AssignmentModel.create({ incidentId: fire.id, responderProfileId: fireUnit.id, assignedById: admin.id, status: "PENDING", notes: "Ladder unit required" });

  const sos1 = await SosRequestModel.create({ citizenId: citizen.id, need: "Water inside home, need evacuation", category: "FLOOD", people: 3, trapped: true, location: "House 42, Riverbank Road, Sector 7", area: "North District", latitude: 28.633, longitude: 77.22, phone: citizen.phone, status: "ASSIGNED", responderProfileId: riverUnit.id });
  const sos2 = await SosRequestModel.create({ citizenId: citizen2.id, need: "Stranded in vehicle, water rising", category: "TRAPPED", people: 4, trapped: true, location: "Sector 7 crossing", area: "North District", status: "SUBMITTED" });
  const sos3 = await SosRequestModel.create({ citizenId: citizen.id, need: "Medical assistance — asthma", category: "MEDICAL", people: 1, location: "Old Market Street", area: "West District", status: "RESOLVED", responderProfileId: riverUnit.id });
  for (const s of [sos1, sos2, sos3]) {
    const pr = computePriority({ category: s.category, peopleAffected: s.people, injuriesReported: s.injuriesReported, trapped: s.trapped, submittedAt: s.createdAt, now: s.createdAt });
    await SosRequestModel.updateOne({ _id: s.id }, { $set: { priorityScore: pr.score, priorityLevel: pr.level, priorityReasons: pr.reasons } });
  }
  await StatusHistoryModel.insertMany([
    { entityType: "SOS", entityId: sos1.id, toStatus: "SUBMITTED", changedById: citizen.id, note: "SOS submitted" },
    { entityType: "SOS", entityId: sos1.id, fromStatus: "SUBMITTED", toStatus: "ACKNOWLEDGED", changedById: responder.id, note: "Acknowledged by control room" },
    { entityType: "SOS", entityId: sos1.id, fromStatus: "ACKNOWLEDGED", toStatus: "ASSIGNED", changedById: admin.id, note: "Assigned to River Rescue 12" },
    { entityType: "SOS", entityId: sos2.id, toStatus: "SUBMITTED", changedById: citizen2.id, note: "SOS submitted" },
    { entityType: "SOS", entityId: sos3.id, toStatus: "SUBMITTED", changedById: citizen.id, note: "SOS submitted" },
    { entityType: "SOS", entityId: sos3.id, fromStatus: "SUBMITTED", toStatus: "ACKNOWLEDGED", changedById: responder.id },
    { entityType: "SOS", entityId: sos3.id, fromStatus: "ACKNOWLEDGED", toStatus: "ASSIGNED", changedById: admin.id },
    { entityType: "SOS", entityId: sos3.id, fromStatus: "ASSIGNED", toStatus: "IN_PROGRESS", changedById: responder.id },
    { entityType: "SOS", entityId: sos3.id, fromStatus: "IN_PROGRESS", toStatus: "RESOLVED", changedById: responder.id, note: "Assistance delivered" },
  ]);

  const alert = await AlertModel.create({ title: "Red alert: river level rising — North District", type: "Flood warning", severity: "CRITICAL", area: "North District", instructions: "Avoid riverbank roads. Move valuables to upper floors. Be ready to evacuate to North District Community Hall if instructed.", source: "District Disaster Office", status: "ACTIVE", reach: 2, issuedById: admin.id, expiresAt: new Date(Date.now() + 12 * 3600 * 1000) });
  await AlertModel.create({ title: "Heavy rainfall warning — citywide", type: "Weather", severity: "HIGH", area: "All districts", instructions: "Expect waterlogging on low-lying roads. Avoid underpasses. Keep phones charged.", source: "Meteorological Dept.", status: "ACTIVE", reach: 4, issuedById: admin.id, expiresAt: new Date(Date.now() + 24 * 3600 * 1000) });
  await AlertModel.create({ title: "Heat advisory — draft", type: "Weather", severity: "LOW", area: "South District", instructions: "Draft guidance on hydration and shade.", status: "DRAFT", issuedById: admin.id });

  await NotificationModel.insertMany([
    { userId: citizen.id, title: alert.title, body: alert.instructions, type: "ALERT", relatedEntityType: "DisasterAlert", relatedEntityId: alert.id },
    { userId: citizen.id, title: "Help is on the way", body: "Unit River Rescue 12 was assigned to your SOS request.", type: "SOS_UPDATE", relatedEntityType: "SOSRequest", relatedEntityId: sos1.id },
    { userId: responder.id, title: "New incident assignment", body: `Your unit River Rescue 12 was assigned to "${flood.title}".`, type: "INCIDENT_UPDATE", relatedEntityType: "Incident", relatedEntityId: flood.id },
  ]);

  await AuditLogModel.insertMany([
    { actorId: admin.id, actorEmail: admin.email, action: "alert.create", targetType: "DisasterAlert", targetId: alert.id, result: "SUCCESS", details: { title: alert.title } },
    { actorId: admin.id, actorEmail: admin.email, action: "incident.assign", targetType: "Incident", targetId: flood.id, result: "SUCCESS", details: { unit: "River Rescue 12" } },
    { actorEmail: "unknown@example.com", action: "auth.login_failed", targetType: "User", result: "DENIED", ipAddress: "203.0.113.8", details: { reason: "wrong password" } },
  ]);

  console.log("Seed complete:");
  console.log("  admin     admin@resqflow.local / Admin@12345");
  console.log("  citizen   citizen@resqflow.local / Citizen@12345");
  console.log("  responder responder@resqflow.local / Responder@12345");
  console.log(`  shelters: ${shelters.length}, units: 2, incidents: 5, sos: 3, alerts: 3`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => disconnectMongo());
