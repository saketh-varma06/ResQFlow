import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { clearDb, disconnectDb } from "./test/db";
import { UserModel } from "./models";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let adminToken = "", citizenToken = "", citizen2Token = "", unit1Token = "", unit2Token = "", unit1Profile = "", unit2Profile = "";

beforeAll(async () => {
  await clearDb();
  citizenToken = (await api().post("/api/auth/register").send({ name: "Verify Citizen", email: "vc@test.local", password: "Citizen@12345", area: "North District" })).body.data.token;
  citizen2Token = (await api().post("/api/auth/register").send({ name: "Second Citizen", email: "vc2@test.local", password: "Citizen@12345", area: "North District" })).body.data.token;
  await api().post("/api/auth/register").send({ name: "Verify Admin", email: "vadmin@test.local", password: "Admin@12345", role: "ADMIN" });
  await UserModel.updateOne({ email: "vadmin@test.local" }, { $set: { status: "ACTIVE" } });
  adminToken = (await api().post("/api/auth/login").send({ email: "vadmin@test.local", password: "Admin@12345" })).body.data.token;
  unit1Profile = (await api().post("/api/responders").set(B(adminToken)).send({ email: "vunit1@test.local", name: "Unit One", password: "Responder@12345", unitName: "Verify Rescue 1", unitType: "Rescue", base: "Base", members: 4 })).body.data.id;
  unit2Profile = (await api().post("/api/responders").set(B(adminToken)).send({ email: "vunit2@test.local", name: "Unit Two", password: "Responder@12345", unitName: "Verify Rescue 2", unitType: "Rescue", base: "Base", members: 4 })).body.data.id;
  unit1Token = (await api().post("/api/auth/login").send({ email: "vunit1@test.local", password: "Responder@12345" })).body.data.token;
  unit2Token = (await api().post("/api/auth/login").send({ email: "vunit2@test.local", password: "Responder@12345" })).body.data.token;
});
afterAll(async () => { await disconnectDb(); });

describe("Stage A — vulnerability flags feed priority transparently", () => {
  it("adds points and a stated reason per flag; no flags keeps the old scoring", async () => {
    const plain = await api().post("/api/sos").set(B(citizenToken)).send({ need: "Water rising in street", category: "FLOOD", people: 2, location: "Riverbank Road", area: "North District" });
    expect(plain.status).toBe(201);
    expect(plain.body.data.priorityScore).toBe(31); // 28 category + 3 people
    expect(plain.body.data.verificationStatus).toBe("UNVERIFIED");
    const flagged = await api().post("/api/sos").set(B(citizenToken)).send({ need: "Water rising in street, grandmother inside", category: "FLOOD", people: 2, location: "Riverbank Road", area: "North District", vulnerableGroups: ["ELDERLY", "CHILDREN"] });
    expect(flagged.status).toBe(201);
    expect(flagged.body.data.priorityScore).toBe(41); // +5 per flag
    expect(flagged.body.data.priorityReasons.join(" ")).toMatch(/Vulnerable people reported: elderly people, children/);
    expect(flagged.body.data.vulnerableGroups).toEqual(["ELDERLY", "CHILDREN"]);
  });
});

describe("Stage A — duplicate candidates + verification lifecycle", () => {
  let sosA = "", sosB = "";
  it("suggests the earlier same-place SOS as a duplicate candidate", async () => {
    sosA = (await api().post("/api/sos").set(B(citizenToken)).send({ need: "Flood water entering homes, need evacuation boat", category: "FLOOD", people: 5, location: "House 4, Lotus Lane", area: "East District", latitude: 28.61, longitude: 77.2 })).body.data.id;
    sosB = (await api().post("/api/sos").set(B(citizen2Token)).send({ need: "Flood water entering homes need evacuation boat urgently", category: "FLOOD", people: 3, location: "House 6, Lotus Lane", area: "East District", latitude: 28.6105, longitude: 77.2005 })).body.data.id;
    const cands = await api().get(`/api/sos/${sosB}/duplicates`).set(B(unit1Token));
    expect(cands.status).toBe(200);
    const hit = (cands.body.data as Array<{ id: string; matchScore: number; matchReasons: string[] }>).find((c) => c.id === sosA);
    expect(hit).toBeTruthy();
    expect(hit!.matchScore).toBeGreaterThanOrEqual(3);
    expect(hit!.matchReasons.join(" ")).toMatch(/close by|Same area|Similar description/i);
  });
  it("citizens cannot verify; responders verify, flag duplicate, and unflag", async () => {
    const forbidden = await api().post(`/api/sos/${sosB}/verify`).set(B(citizenToken));
    expect(forbidden.status).toBe(403);
    const verified = await api().post(`/api/sos/${sosA}/verify`).set(B(unit1Token));
    expect(verified.status).toBe(200);
    expect(verified.body.data.verificationStatus).toBe("VERIFIED");
    const flagged = await api().post(`/api/sos/${sosB}/mark-duplicate`).set(B(unit1Token)).send({ duplicateOfId: sosA });
    expect(flagged.status).toBe(200);
    expect(flagged.body.data.verificationStatus).toBe("FLAGGED_DUPLICATE");
    expect(flagged.body.data.duplicateOfId).toBe(sosA);
    const candsAfter = await api().get(`/api/sos/${sosA}/duplicates`).set(B(unit1Token));
    expect((candsAfter.body.data as Array<{ id: string }>).some((c) => c.id === sosB)).toBe(false);
    const unflagged = await api().post(`/api/sos/${sosB}/unflag-duplicate`).set(B(adminToken));
    expect(unflagged.body.data.verificationStatus).toBe("UNVERIFIED");
    expect(unflagged.body.data.duplicateOfId).toBeNull();
  });
});

describe("Stage A — claim lock on SOS", () => {
  it("second unit gets 409 until the first releases", async () => {
    const sos = (await api().post("/api/sos").set(B(citizenToken)).send({ need: "Need drinking water delivery", category: "OTHER", people: 6, location: "Community Hall", area: "West District" })).body.data;
    const claim1 = await api().post(`/api/sos/${sos.id}/assign`).set(B(unit1Token)).send({ responderProfileId: unit1Profile });
    expect(claim1.status).toBe(200);
    expect(claim1.body.data.status).toBe("ASSIGNED");
    const blocked = await api().post(`/api/sos/${sos.id}/assign`).set(B(unit2Token)).send({ responderProfileId: unit2Profile });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/already claimed/);
    const wrongRelease = await api().post(`/api/sos/${sos.id}/release`).set(B(unit2Token));
    expect(wrongRelease.status).toBe(403);
    const released = await api().post(`/api/sos/${sos.id}/release`).set(B(unit1Token));
    expect(released.status).toBe(200);
    expect(released.body.data.status).toBe("ACKNOWLEDGED");
    expect(released.body.data.responderProfileId).toBeNull();
    const claim2 = await api().post(`/api/sos/${sos.id}/assign`).set(B(unit2Token)).send({ responderProfileId: unit2Profile });
    expect(claim2.status).toBe(200);
    expect(claim2.body.data.responderProfileId).toBe(unit2Profile);
  });
});

describe("Stage A — claim lock on incidents", () => {
  it("claim, 409 for the second unit, release returns it to the pool", async () => {
    const inc = (await api().post("/api/incidents").set(B(citizenToken)).send({ title: "Bridge approach road flooded", type: "FLOOD", severity: "HIGH", description: "Water over the bridge approach road, vehicles stranded", location: "Old Bridge", area: "North District", peopleAffected: 12 })).body.data;
    const claim = await api().post(`/api/incidents/${inc.id}/claim`).set(B(unit1Token));
    expect(claim.status).toBe(201);
    const blocked = await api().post(`/api/incidents/${inc.id}/claim`).set(B(unit2Token));
    expect(blocked.status).toBe(409);
    const wrongRelease = await api().post(`/api/incidents/${inc.id}/release`).set(B(unit2Token));
    expect(wrongRelease.status).toBe(400);
    const released = await api().post(`/api/incidents/${inc.id}/release`).set(B(unit1Token));
    expect(released.status).toBe(200);
    const after = await api().get(`/api/incidents/${inc.id}`).set(B(adminToken));
    expect(after.body.data.status).toBe("ACKNOWLEDGED");
    const claim2 = await api().post(`/api/incidents/${inc.id}/claim`).set(B(unit2Token));
    expect(claim2.status).toBe(201);
  });
});
