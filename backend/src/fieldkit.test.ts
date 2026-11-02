import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { clearDb, disconnectDb } from "./test/db";
import { UserModel } from "./models";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let adminToken = "", citizenToken = "", unitAToken = "", unitBToken = "", unitAProfile = "", incidentId = "", sosId = "";

beforeAll(async () => {
  await clearDb();
  citizenToken = (await api().post("/api/auth/register").send({ name: "Field Citizen", email: "fc@test.local", password: "Citizen@12345", area: "North District" })).body.data.token;
  await api().post("/api/auth/register").send({ name: "Field Admin", email: "fadmin@test.local", password: "Admin@12345", role: "ADMIN" });
  await UserModel.updateOne({ email: "fadmin@test.local" }, { $set: { status: "ACTIVE" } });
  adminToken = (await api().post("/api/auth/login").send({ email: "fadmin@test.local", password: "Admin@12345" })).body.data.token;
  unitAProfile = (await api().post("/api/responders").set(B(adminToken)).send({ email: "unita@test.local", name: "Unit A Lead", password: "Responder@12345", unitName: "Alpha Rescue", unitType: "Rescue", base: "Base A", members: 5 })).body.data.id;
  await api().post("/api/responders").set(B(adminToken)).send({ email: "unitb@test.local", name: "Unit B Lead", password: "Responder@12345", unitName: "Bravo Rescue", unitType: "Rescue", base: "Base B", members: 5 });
  unitAToken = (await api().post("/api/auth/login").send({ email: "unita@test.local", password: "Responder@12345" })).body.data.token;
  unitBToken = (await api().post("/api/auth/login").send({ email: "unitb@test.local", password: "Responder@12345" })).body.data.token;
  incidentId = (await api().post("/api/incidents").set(B(citizenToken)).send({ title: "Riverbank flooding near the ghat", type: "FLOOD", severity: "HIGH", description: "Water rising along the riverbank, homes at risk", location: "Old Ghat Road", area: "North District", latitude: 28.62, longitude: 77.21, peopleAffected: 30 })).body.data.id;
  await api().post(`/api/incidents/${incidentId}/assign`).set(B(adminToken)).send({ responderProfileId: unitAProfile });
  sosId = (await api().post("/api/sos").set(B(citizenToken)).send({ need: "Need evacuation from flooded street", category: "FLOOD", people: 3, location: "Old Ghat Road", area: "North District", latitude: 28.621, longitude: 77.211 })).body.data.id;
});
afterAll(async () => { await disconnectDb(); });

describe("Stage E — idempotent offline sync", () => {
  it("a retried SOS submission returns the original record, not a duplicate", async () => {
    const payload = { need: "Idempotency check SOS request", category: "OTHER", people: 1, location: "Somewhere", clientRequestId: "test-uuid-1234" };
    const first = await api().post("/api/sos").set(B(citizenToken)).send(payload);
    const second = await api().post("/api/sos").set(B(citizenToken)).send(payload);
    expect(first.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    const mine = await api().get("/api/sos?mine=true&limit=50").set(B(citizenToken));
    expect((mine.body.data as Array<{ need: string }>).filter((s) => s.need === payload.need)).toHaveLength(1);
  });
  it("the same protection applies to incident reports", async () => {
    const payload = { title: "Idempotency check incident report", type: "OTHER", severity: "LOW", description: "A report that must only exist once", location: "Somewhere", area: "North District", clientRequestId: "test-uuid-9876" };
    const first = await api().post("/api/incidents").set(B(citizenToken)).send(payload);
    const second = await api().post("/api/incidents").set(B(citizenToken)).send(payload);
    expect(second.body.data.id).toBe(first.body.data.id);
  });
});

describe("Stage E — checklists", () => {
  it("serves the FLOOD checklist for a flood incident", async () => {
    const res = await api().get(`/api/incidents/${incidentId}/checklist`).set(B(unitAToken));
    expect(res.status).toBe(200);
    expect(res.body.data.category).toBe("FLOOD");
    expect(res.body.data.totalCount).toBeGreaterThanOrEqual(5);
    expect(res.body.data.items.every((i: { key: string }) => i.key.startsWith("flood-"))).toBe(true);
  });
  it("persists ticks for the assigned unit and refuses other units", async () => {
    const cl = await api().get(`/api/incidents/${incidentId}/checklist`).set(B(unitAToken));
    const keys = (cl.body.data.items as Array<{ key: string }>).slice(0, 2).map((i) => i.key);
    const patched = await api().patch(`/api/incidents/${incidentId}/checklist`).set(B(unitAToken)).send({ checkedKeys: keys });
    expect(patched.status).toBe(200);
    expect(patched.body.data.completedCount).toBe(2);
    const refused = await api().patch(`/api/incidents/${incidentId}/checklist`).set(B(unitBToken)).send({ checkedKeys: keys });
    expect(refused.status).toBe(403);
    const asCitizen = await api().patch(`/api/incidents/${incidentId}/checklist`).set(B(citizenToken)).send({ checkedKeys: keys });
    expect(asCitizen.status).toBe(403);
  });
  it("an unassigned SOS can be worked by any responder until it is claimed", async () => {
    const patched = await api().patch(`/api/sos/${sosId}/checklist`).set(B(unitBToken)).send({ checkedKeys: ["flood-0"] });
    expect(patched.status).toBe(200);
  });
});

describe("Stage E — field reports", () => {
  it("the assigned unit files a structured report the citizen can read", async () => {
    const created = await api().post(`/api/incidents/${incidentId}/field-reports`).set(B(unitAToken)).send({ situation: "Water knee-deep along the ghat, still rising slowly", peopleCount: 34, injuriesCount: 2, needsSummary: "One more boat and dry food kits", risks: "Current strengthening near the steps" });
    expect(created.status).toBe(201);
    expect(created.body.data.author.name).toBe("Unit A Lead");
    const list = await api().get(`/api/incidents/${incidentId}/field-reports`).set(B(citizenToken));
    expect(list.status).toBe(200);
    expect(list.body.data[0].situation).toMatch(/knee-deep/);
    const refused = await api().post(`/api/incidents/${incidentId}/field-reports`).set(B(unitBToken)).send({ situation: "Unassigned unit trying to file a report" });
    expect(refused.status).toBe(403);
  });
});
