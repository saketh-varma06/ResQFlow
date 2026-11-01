import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "./app";
import { prisma } from "./database/prisma";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let adminToken = "", citizenToken = "", respAToken = "", respBToken = "";
let profileA = "", profileB = "", incidentId = "", citizenId = "";

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "AuditLog","Notification","IncidentStatusHistory","IncidentAssignment","SOSRequest","Incident","DisasterAlert","Shelter","ResponderProfile","User" RESTART IDENTITY CASCADE`);
  const reg = await api().post("/api/auth/register").send({ name: "Cookie Citizen", email: "cc@test.local", password: "Citizen@12345", area: "North District" });
  citizenToken = reg.body.data.token; citizenId = reg.body.data.user.id;
  await api().post("/api/auth/register").send({ name: "Boss", email: "boss@test.local", password: "Admin@12345", role: "ADMIN" });
  await prisma.user.update({ where: { email: "boss@test.local" }, data: { status: "ACTIVE" } });
  adminToken = (await api().post("/api/auth/login").send({ email: "boss@test.local", password: "Admin@12345" })).body.data.token;
  const mk = async (email: string, unit: string) => {
    const r = await api().post("/api/responders").set(B(adminToken)).send({ email, name: unit, password: "Responder@12345", unitName: unit, unitType: "Rescue", base: "Base", members: 4 });
    expect(r.status).toBe(201);
    const login = await api().post("/api/auth/login").send({ email, password: "Responder@12345" });
    return { profileId: r.body.data.id as string, token: login.body.data.token as string };
  };
  const a = await mk("unita@test.local", "Unit A"); profileA = a.profileId; respAToken = a.token;
  const b = await mk("unitb@test.local", "Unit B"); profileB = b.profileId; respBToken = b.token;
  const inc = await api().post("/api/incidents").set(B(citizenToken)).send({ title: "Authz test incident", type: "FLOOD", severity: "HIGH", description: "Incident used to test responder authorization boundaries.", location: "Boundary Road", area: "North District" });
  incidentId = inc.body.data.id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("cookie session + CSRF", () => {
  it("login sets an httpOnly session cookie and a CSRF cookie; cookie alone authenticates reads", async () => {
    const login = await api().post("/api/auth/login").send({ email: "cc@test.local", password: "Citizen@12345" });
    expect(login.status).toBe(200);
    const cookies = (login.headers["set-cookie"] as unknown as string[]).join("\n");
    expect(cookies).toMatch(/resqflow_session=[^;]+;[^]*HttpOnly/i);
    expect(cookies).toMatch(/resqflow_csrf=/i);
    const session = /resqflow_session=([^;]+)/.exec(cookies)![1];
    const csrf = /resqflow_csrf=([^;]+)/.exec(cookies)![1];
    const cookieHeader = `resqflow_session=${session}; resqflow_csrf=${csrf}`;
    const me = await api().get("/api/auth/me").set("Cookie", cookieHeader);
    expect(me.status).toBe(200); expect(me.body.data.email).toBe("cc@test.local");
    // Mutating request with the session cookie but WITHOUT the CSRF header → 403
    const noCsrf = await api().post("/api/sos").set("Cookie", cookieHeader).send({ need: "Help needed", category: "OTHER", location: "Boundary Road" });
    expect(noCsrf.status).toBe(403); expect(noCsrf.body.error).toMatch(/CSRF/i);
    // Same request WITH the double-submit header → 201
    const withCsrf = await api().post("/api/sos").set("Cookie", cookieHeader).set("x-csrf-token", csrf).send({ need: "Help needed", category: "OTHER", location: "Boundary Road" });
    expect(withCsrf.status).toBe(201);
  });
});

describe("session invalidation + expiry", () => {
  it("logout invalidates the previously issued token (bearer and cookie share the mechanism)", async () => {
    const login = await api().post("/api/auth/login").send({ email: "cc@test.local", password: "Citizen@12345" });
    const token = login.body.data.token as string;
    expect((await api().get("/api/auth/me").set(B(token))).status).toBe(200);
    expect((await api().post("/api/auth/logout").set(B(token))).status).toBe(200);
    expect((await api().get("/api/auth/me").set(B(token))).status).toBe(401);
    const relogin = await api().post("/api/auth/login").send({ email: "cc@test.local", password: "Citizen@12345" });
    expect(relogin.status).toBe(200);
    citizenToken = relogin.body.data.token;
  });
  it("an expired token is rejected with 401", async () => {
    const user = await prisma.user.findUnique({ where: { email: "cc@test.local" } });
    const expired = jwt.sign({ sub: user!.id, email: user!.email, role: user!.role, tv: user!.tokenVersion }, process.env.JWT_SECRET!, { expiresIn: "-10s" });
    expect((await api().get("/api/auth/me").set(B(expired))).status).toBe(401);
  });
  it("changing the password invalidates the old session and the old password", async () => {
    const change = await api().post("/api/auth/change-password").set(B(citizenToken)).send({ currentPassword: "Citizen@12345", newPassword: "Citizen@67890" });
    expect(change.status).toBe(200);
    expect((await api().get("/api/auth/me").set(B(citizenToken))).status).toBe(401);
    expect((await api().post("/api/auth/login").send({ email: "cc@test.local", password: "Citizen@12345" })).status).toBe(401);
    const relogin = await api().post("/api/auth/login").send({ email: "cc@test.local", password: "Citizen@67890" });
    expect(relogin.status).toBe(200);
    citizenToken = relogin.body.data.token;
  });
});

describe("registration privilege rules", () => {
  it("public registration as RESPONDER stays PENDING and cannot log in", async () => {
    const reg = await api().post("/api/auth/register").send({ name: "Hopeful", email: "hopeful@test.local", password: "Responder@12345", role: "RESPONDER" });
    expect(reg.status).toBe(201); expect(reg.body.data.token).toBeNull(); expect(reg.body.data.user.status).toBe("PENDING");
    const login = await api().post("/api/auth/login").send({ email: "hopeful@test.local", password: "Responder@12345" });
    expect(login.status).toBe(403);
  });
});

describe("role boundaries on records", () => {
  it("citizen is blocked from admin APIs (alerts create, audit, users, analytics)", async () => {
    expect((await api().post("/api/alerts").set(B(citizenToken)).send({ title: "Citizen must not publish", type: "Weather", severity: "LOW", area: "North District", instructions: "This must be rejected by role checks." })).status).toBe(403);
    expect((await api().get("/api/audit-logs").set(B(citizenToken))).status).toBe(403);
    expect((await api().get("/api/users").set(B(citizenToken))).status).toBe(403);
    expect((await api().get("/api/analytics/overview").set(B(citizenToken))).status).toBe(403);
  });
  it("responder cannot touch an incident that is not assigned to their unit", async () => {
    expect((await api().patch(`/api/incidents/${incidentId}/status`).set(B(respBToken)).send({ status: "ACKNOWLEDGED" })).status).toBe(403);
    expect((await api().post(`/api/incidents/${incidentId}/notes`).set(B(respBToken)).send({ note: "Unit B was never assigned here." })).status).toBe(403);
    expect((await api().get("/api/users").set(B(respBToken))).status).toBe(403);
    expect((await api().get("/api/audit-logs").set(B(respBToken))).status).toBe(403);
  });
  it("assigned responder CAN add notes and update status; notes land in the timeline", async () => {
    const assign = await api().post(`/api/incidents/${incidentId}/assign`).set(B(adminToken)).send({ responderProfileId: profileA });
    expect(assign.status).toBe(201);
    const note = await api().post(`/api/incidents/${incidentId}/notes`).set(B(respAToken)).send({ note: "Arrived on site, water at knee level." });
    expect(note.status).toBe(201);
    const detail = await api().get(`/api/incidents/${incidentId}`).set(B(respAToken));
    expect(detail.body.data.statusHistory.some((h: { note?: string }) => h.note === "Arrived on site, water at knee level.")).toBe(true);
    const status = await api().patch(`/api/incidents/${incidentId}/status`).set(B(respAToken)).send({ status: "IN_PROGRESS", note: "Evacuation started" });
    expect(status.status).toBe(200);
  });
  it("responder updates own availability; citizen cannot", async () => {
    const r = await api().patch("/api/responders/me/availability").set(B(respAToken)).send({ readiness: "AVAILABLE" });
    expect(r.status).toBe(200); expect(r.body.data.readiness).toBe("AVAILABLE");
    expect((await api().patch("/api/responders/me/availability").set(B(citizenToken)).send({ readiness: "AVAILABLE" })).status).toBe(403);
    void profileB;
  });
});
