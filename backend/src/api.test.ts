import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { prisma } from "./database/prisma";

const api = () => request(app);
let adminToken = "", citizenToken = "", responderToken = "";
let citizenId = "", responderProfileId = "", incidentId = "", sosId = "";
const B = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "AuditLog","Notification","IncidentStatusHistory","IncidentAssignment","SOSRequest","Incident","DisasterAlert","Shelter","ResponderProfile","User" RESTART IDENTITY CASCADE`);
  // Citizen registers + logs in
  const reg = await api().post("/api/auth/register").send({ name: "Test Citizen", email: "citizen@test.local", password: "Citizen@12345", area: "North District" });
  expect(reg.status).toBe(201);
  citizenToken = reg.body.data.token; citizenId = reg.body.data.user.id;
  // Admin: register then promote directly in the DB (public registration cannot self-approve elevated roles)
  const adm = await api().post("/api/auth/register").send({ name: "Test Admin", email: "admin@test.local", password: "Admin@12345", role: "ADMIN" });
  expect(adm.status).toBe(201);
  expect(adm.body.data.token).toBeNull(); // pending approval — no token issued
  await prisma.user.update({ where: { email: "admin@test.local" }, data: { status: "ACTIVE" } });
  const admLogin = await api().post("/api/auth/login").send({ email: "admin@test.local", password: "Admin@12345" });
  expect(admLogin.status).toBe(200);
  adminToken = admLogin.body.data.token;
  // Responder created by admin (account + unit profile in one call)
  const resp = await api().post("/api/responders").set(B(adminToken)).send({ email: "unit@test.local", name: "Unit Lead", password: "Responder@12345", unitName: "Test Rescue 1", unitType: "Water rescue", base: "North Station", members: 6 });
  expect(resp.status).toBe(201);
  responderProfileId = resp.body.data.id;
  const respLogin = await api().post("/api/auth/login").send({ email: "unit@test.local", password: "Responder@12345" });
  expect(respLogin.status).toBe(200);
  responderToken = respLogin.body.data.token;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("health", () => {
  it("reports ok with database up", async () => {
    const r = await api().get("/api/health");
    expect(r.status).toBe(200); expect(r.body.status).toBe("ok"); expect(r.body.database).toBe("up"); expect(r.body.phase).toBe(2);
  });
  it("serves the OpenAPI spec and Swagger UI", async () => {
    const spec = await api().get("/api/docs.json");
    expect(spec.status).toBe(200); expect(spec.body.openapi).toBe("3.0.3"); expect(Object.keys(spec.body.paths).length).toBeGreaterThan(20);
    const ui = await api().get("/api/docs/");
    expect(ui.status).toBe(200); expect(ui.text).toContain("swagger");
  });
});

describe("auth", () => {
  it("rejects duplicate registration with 409", async () => {
    const r = await api().post("/api/auth/register").send({ name: "Dup", email: "citizen@test.local", password: "Citizen@12345" });
    expect(r.status).toBe(409);
  });
  it("rejects invalid registration body with 400", async () => {
    const r = await api().post("/api/auth/register").send({ name: "X", email: "not-an-email", password: "short" });
    expect(r.status).toBe(400);
  });
  it("rejects wrong password with 401 and writes a DENIED audit entry", async () => {
    const r = await api().post("/api/auth/login").send({ email: "citizen@test.local", password: "WrongPass@1" });
    expect(r.status).toBe(401);
    const audit = await api().get("/api/audit-logs?result=DENIED").set(B(adminToken));
    expect(audit.status).toBe(200); expect(audit.body.meta.total).toBeGreaterThan(0);
  });
  it("/me requires auth and returns the user without passwordHash", async () => {
    expect((await api().get("/api/auth/me")).status).toBe(401);
    const r = await api().get("/api/auth/me").set(B(citizenToken));
    expect(r.status).toBe(200); expect(r.body.data.id).toBe(citizenId); expect(r.body.data.passwordHash).toBeUndefined();
  });
  it("citizen cannot list users (403), admin can", async () => {
    expect((await api().get("/api/users").set(B(citizenToken))).status).toBe(403);
    const r = await api().get("/api/users").set(B(adminToken));
    expect(r.status).toBe(200); expect(r.body.meta.total).toBeGreaterThanOrEqual(3);
  });
  it("updates own profile via PATCH /users/me", async () => {
    const r = await api().patch("/api/users/me").set(B(citizenToken)).send({ address: "12 Test Lane", bloodGroup: "B+" });
    expect(r.status).toBe(200); expect(r.body.data.address).toBe("12 Test Lane");
  });
});

describe("incidents + assignment lifecycle", () => {
  it("citizen creates an incident; invalid body 400s", async () => {
    const bad = await api().post("/api/incidents").set(B(citizenToken)).send({ title: "x" });
    expect(bad.status).toBe(400);
    const r = await api().post("/api/incidents").set(B(citizenToken)).send({ title: "Flooding on Test Street", type: "FLOOD", severity: "HIGH", description: "Water entering homes on Test Street, needs evacuation support.", location: "Test Street 1", area: "North District", peopleAffected: 25 });
    expect(r.status).toBe(201); expect(r.body.data.status).toBe("SUBMITTED"); expect(typeof r.body.data.createdAt).toBe("string"); expect(r.body.data.priorityScore).toBeGreaterThan(0); expect(Array.isArray(r.body.data.priorityReasons)).toBe(true);
    incidentId = r.body.data.id;
  });
  it("detail includes status history starting at SUBMITTED", async () => {
    const r = await api().get(`/api/incidents/${incidentId}`).set(B(citizenToken));
    expect(r.status).toBe(200);
    expect(r.body.data.statusHistory.some((h: { toStatus: string }) => h.toStatus === "SUBMITTED")).toBe(true);
  });
  it("citizen cannot change incident status (403)", async () => {
    const r = await api().patch(`/api/incidents/${incidentId}/status`).set(B(citizenToken)).send({ status: "ACKNOWLEDGED" });
    expect(r.status).toBe(403);
  });
  it("admin assigns the unit; responder accepts then completes; reporter is notified", async () => {
    const a = await api().post(`/api/incidents/${incidentId}/assign`).set(B(adminToken)).send({ responderProfileId, notes: "Bring boats" });
    expect(a.status).toBe(201); expect(a.body.data.status).toBe("PENDING");
    const afterAssign = await api().get(`/api/incidents/${incidentId}`).set(B(adminToken));
    expect(afterAssign.body.data.status).toBe("ASSIGNED");
    const acc = await api().post(`/api/incidents/${incidentId}/accept`).set(B(responderToken));
    expect(acc.status).toBe(200); expect(acc.body.data.status).toBe("ACCEPTED");
    const afterAccept = await api().get(`/api/incidents/${incidentId}`).set(B(adminToken));
    expect(afterAccept.body.data.status).toBe("IN_PROGRESS");
    const comp = await api().post(`/api/incidents/${incidentId}/complete`).set(B(responderToken));
    expect(comp.status).toBe(200); expect(comp.body.data.status).toBe("COMPLETED");
    const afterComplete = await api().get(`/api/incidents/${incidentId}`).set(B(adminToken));
    expect(afterComplete.body.data.status).toBe("RESOLVED");
    const notif = await api().get("/api/notifications?unreadOnly=true").set(B(citizenToken));
    expect(notif.status).toBe(200); expect(notif.body.meta.total).toBeGreaterThan(0);
  });
  it("lists with filters and pagination meta", async () => {
    const r = await api().get("/api/incidents?status=RESOLVED&limit=5").set(B(citizenToken));
    expect(r.status).toBe(200); expect(r.body.meta).toMatchObject({ page: 1, limit: 5 });
    expect(r.body.data.every((i: { status: string }) => i.status === "RESOLVED")).toBe(true);
  });
});

describe("sos", () => {
  it("citizen creates SOS; citizens only see their own", async () => {
    const r = await api().post("/api/sos").set(B(citizenToken)).send({ need: "Need evacuation", category: "FLOOD", people: 2, location: "Test Street 1", area: "North District" });
    expect(r.status).toBe(201); sosId = r.body.data.id;
    const mine = await api().get("/api/sos").set(B(citizenToken));
    expect(mine.body.data.every((s: { citizenId: string }) => s.citizenId === citizenId)).toBe(true);
  });
  it("responder self-assigns the SOS (ASSIGNED) and can resolve it", async () => {
    const a = await api().post(`/api/sos/${sosId}/assign`).set(B(responderToken)).send({ responderProfileId });
    expect(a.status).toBe(200); expect(a.body.data.status).toBe("ASSIGNED");
    const started = await api().patch(`/api/sos/${sosId}/status`).set(B(responderToken)).send({ status: "IN_PROGRESS" });
    expect(started.status).toBe(200);
    const u = await api().patch(`/api/sos/${sosId}/status`).set(B(responderToken)).send({ status: "RESOLVED" });
    expect(u.status).toBe(200); expect(u.body.data.status).toBe("RESOLVED");
  });
});

describe("shelters + alerts", () => {
  it("shelters are public; citizens cannot create (403); occupied>capacity is 400", async () => {
    expect((await api().get("/api/shelters")).status).toBe(200);
    expect((await api().post("/api/shelters").set(B(citizenToken)).send({ name: "X Shelter", address: "Addr", area: "North", capacity: 10 })).status).toBe(403);
    const bad = await api().post("/api/shelters").set(B(adminToken)).send({ name: "Bad Shelter", address: "Addr", area: "North District", capacity: 10, occupied: 11 });
    expect(bad.status).toBe(400);
  });
  it("admin creates a shelter and status is derived (95% → NEARLY_FULL)", async () => {
    const r = await api().post("/api/shelters").set(B(adminToken)).send({ name: "Test Hall", address: "1 Test Road", area: "North District", capacity: 100, occupied: 95, facilities: ["Beds"] });
    expect(r.status).toBe(201); expect(r.body.data.status).toBe("NEARLY_FULL");
  });
  it("citizens see only ACTIVE alerts; admin alert notifies area citizens", async () => {
    const draft = await api().post("/api/alerts").set(B(adminToken)).send({ title: "Draft alert not public yet", type: "Weather", severity: "LOW", area: "North District", instructions: "Draft instructions that are not yet public.", status: "DRAFT" });
    expect(draft.status).toBe(201);
    const pub = await api().get("/api/alerts").set(B(citizenToken));
    expect(pub.body.data.every((a: { status: string }) => a.status === "ACTIVE")).toBe(true);
    const before = await api().get("/api/notifications/unread-count").set(B(citizenToken));
    const created = await api().post("/api/alerts").set(B(adminToken)).send({ title: "Test flood warning for North", type: "Flood warning", severity: "HIGH", area: "North District", instructions: "Move to higher ground and avoid riverbank roads today.", status: "ACTIVE" });
    expect(created.status).toBe(201); expect(created.body.data.reach).toBeGreaterThanOrEqual(1);
    const after = await api().get("/api/notifications/unread-count").set(B(citizenToken));
    expect(after.body.data.unread).toBeGreaterThan(before.body.data.unread);
  });
});

describe("notifications, analytics, audit", () => {
  it("mark-all-read zeroes the unread count", async () => {
    const r = await api().post("/api/notifications/read-all").set(B(citizenToken));
    expect(r.status).toBe(200);
    const c = await api().get("/api/notifications/unread-count").set(B(citizenToken));
    expect(c.body.data.unread).toBe(0);
  });
  it("analytics is forbidden for citizens and works for admin", async () => {
    expect((await api().get("/api/analytics/overview").set(B(citizenToken))).status).toBe(403);
    const r = await api().get("/api/analytics/overview").set(B(adminToken));
    expect(r.status).toBe(200);
    expect(r.body.data.incidents.total).toBeGreaterThanOrEqual(1);
    expect(r.body.data.incidents.reportedLast7Days).toHaveLength(7);
    expect(r.body.data.shelters).toHaveProperty("occupancyPercent");
  });
  it("audit log records the session's actions for admins only", async () => {
    expect((await api().get("/api/audit-logs").set(B(citizenToken))).status).toBe(403);
    const r = await api().get("/api/audit-logs?action=incident.assign").set(B(adminToken));
    expect(r.status).toBe(200); expect(r.body.meta.total).toBeGreaterThanOrEqual(1);
  });
});
