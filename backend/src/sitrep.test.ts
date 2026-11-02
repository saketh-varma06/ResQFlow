import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { clearDb, disconnectDb } from "./test/db";
import { UserModel } from "./models";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let adminToken = "", citizenToken = "", incidentId = "";

beforeAll(async () => {
  await clearDb();
  citizenToken = (await api().post("/api/auth/register").send({ name: "Sitrep Citizen", email: "sc@test.local", password: "Citizen@12345", area: "North District" })).body.data.token;
  await api().post("/api/auth/register").send({ name: "Sitrep Admin", email: "sadmin@test.local", password: "Admin@12345", role: "ADMIN" });
  await UserModel.updateOne({ email: "sadmin@test.local" }, { $set: { status: "ACTIVE" } });
  adminToken = (await api().post("/api/auth/login").send({ email: "sadmin@test.local", password: "Admin@12345" })).body.data.token;
  incidentId = (await api().post("/api/incidents").set(B(citizenToken)).send({ title: "Sitrep flood incident for testing", type: "FLOOD", severity: "CRITICAL", description: "Severe flooding used to exercise the situation report", location: "Low Bridge", area: "North District", peopleAffected: 120, trapped: true })).body.data.id;
  await api().post("/api/sos").set(B(citizenToken)).send({ need: "Sitrep SOS needing a boat rescue", category: "FLOOD", people: 6, location: "Low Bridge", area: "North District", trapped: true });
  await api().post("/api/shelters").set(B(adminToken)).send({ name: "Sitrep Shelter", address: "1 Test Way", area: "North District", capacity: 50, occupied: 50 });
});
afterAll(async () => { await disconnectDb(); });

describe("Stage F — situation report", () => {
  it("builds the report from live counts", async () => {
    const res = await api().get("/api/analytics/sitrep").set(B(adminToken));
    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r.overview.openIncidents).toBe(1);
    expect(r.overview.openSos).toBe(1);
    expect(r.overview.pendingSos).toBe(1);
    expect(r.last24h.newIncidents).toBe(1);
    expect(r.last24h.newSos).toBe(1);
    expect(r.openBySeverity).toEqual([{ severity: "CRITICAL", count: 1 }]);
    expect(r.shelters.utilizationPercent).toBe(100);
    expect(r.shelters.fullShelters).toContain("Sitrep Shelter");
    expect(r.topPriorities[0].priorityLevel).toBe("CRITICAL");
  });
  it("renders a paste-ready text SitRep", async () => {
    const res = await api().get("/api/analytics/sitrep?format=text").set(B(adminToken));
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/SITUATION REPORT/);
    expect(res.text).toMatch(/Open incidents: 1/);
    expect(res.text).toMatch(/Sitrep Shelter/);
  });
  it("is staff-only", async () => {
    expect((await api().get("/api/analytics/sitrep").set(B(citizenToken))).status).toBe(403);
  });
});

describe("Stage F — after-action replay", () => {
  it("streams status changes in chronological order with titles", async () => {
    await api().patch(`/api/incidents/${incidentId}/status`).set(B(adminToken)).send({ status: "ACKNOWLEDGED" });
    await api().patch(`/api/incidents/${incidentId}/status`).set(B(adminToken)).send({ status: "ASSIGNED" });
    const res = await api().get("/api/analytics/replay?hours=24").set(B(adminToken));
    expect(res.status).toBe(200);
    const statusEvents = (res.body.data.events as Array<{ kind: string; title: string; detail: string }>).filter((e) => e.kind === "STATUS");
    expect(statusEvents.length).toBeGreaterThanOrEqual(2);
    expect(statusEvents[0].title).toMatch(/Sitrep flood incident/);
    const ats = (res.body.data.events as Array<{ at: string }>).map((e) => e.at);
    expect([...ats].sort()).toEqual(ats);
  });
  it("is admin-only", async () => {
    expect((await api().get("/api/analytics/replay").set(B(citizenToken))).status).toBe(403);
  });
});

describe("Stage F — new external layers", () => {
  it("overview carries EONET + flood blocks with honest provenance", async () => {
    const res = await api().get("/api/external/overview").set(B(citizenToken));
    expect(res.status).toBe(200);
    for (const key of ["eonet", "flood"] as const) {
      const block = res.body.data[key];
      expect(block, key).toBeDefined();
      expect(["ok", "stale", "unavailable"]).toContain(block.status);
      expect(block.source.length).toBeGreaterThan(3);
      if (block.status === "ok") expect(Array.isArray(block.data)).toBe(true);
    }
  });
});
