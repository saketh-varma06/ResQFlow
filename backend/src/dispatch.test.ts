import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "./app";
import { clearDb, disconnectDb } from "./test/db";
import { UserModel } from "./models";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let adminToken = "", citizenToken = "", nearProfile = "", farProfile = "";

// Deterministic OSRM stub: durations scale with the coordinate spread so the
// "near" unit always wins; returning real road-shaped data without the network.
function stubOsrm(mode: "ok" | "down") {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (mode === "down") throw new Error("network down");
    if (url.includes("/table/")) {
      // Coordinate-aware: duration/distance grow with the gap to the last coordinate (the target),
      // so the ranking assertion holds regardless of unit ordering.
      const coordsPart = url.split("/driving/")[1].split("?")[0];
      const pts = coordsPart.split(";").map((p) => p.split(",").map(Number) as [number, number]);
      const target = pts[pts.length - 1];
      const durations = pts.slice(0, -1).map(([lng, lat]) => [Math.round(Math.hypot(lng - target[0], lat - target[1]) * 100000)]);
      const distances = pts.slice(0, -1).map(([lng, lat]) => [Math.round(Math.hypot(lng - target[0], lat - target[1]) * 1000000)]);
      return { ok: true, json: async () => ({ code: "Ok", durations, distances }) };
    }
    if (url.includes("/route/")) {
      return { ok: true, json: async () => ({ code: "Ok", routes: [{ duration: 660, distance: 9000, geometry: { type: "LineString", coordinates: [[77.231, 28.656], [77.22, 28.63], [77.21, 28.614]] } }] }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
}

beforeAll(async () => {
  await clearDb();
  citizenToken = (await api().post("/api/auth/register").send({ name: "Dispatch Citizen", email: "dc@test.local", password: "Citizen@12345", area: "North District" })).body.data.token;
  await api().post("/api/auth/register").send({ name: "Dispatch Admin", email: "dadmin@test.local", password: "Admin@12345", role: "ADMIN" });
  await UserModel.updateOne({ email: "dadmin@test.local" }, { $set: { status: "ACTIVE" } });
  adminToken = (await api().post("/api/auth/login").send({ email: "dadmin@test.local", password: "Admin@12345" })).body.data.token;
  nearProfile = (await api().post("/api/responders").set(B(adminToken)).send({ email: "near@test.local", name: "Near Unit", password: "Responder@12345", unitName: "Near Rescue 1", unitType: "Rescue", base: "Near Base", baseLat: 28.65, baseLng: 77.225, members: 4, readiness: "AVAILABLE" })).body.data.id;
  farProfile = (await api().post("/api/responders").set(B(adminToken)).send({ email: "far@test.local", name: "Far Unit", password: "Responder@12345", unitName: "Far Rescue 9", unitType: "Rescue", base: "Far Base", baseLat: 28.45, baseLng: 77.05, members: 4, readiness: "AVAILABLE" })).body.data.id;
  // A unit with no coordinates at all — must be reported as unranked, never silently dropped.
  await api().post("/api/responders").set(B(adminToken)).send({ email: "nocoord@test.local", name: "No Coord Unit", password: "Responder@12345", unitName: "Unlocated Unit", unitType: "Rescue", base: "Unknown Base", members: 2, readiness: "AVAILABLE" });
});
afterAll(async () => { vi.unstubAllGlobals(); await disconnectDb(); });

describe("Stage C — OSRM dispatch ranking", () => {
  it("ranks units by road time with ETA and distance", async () => {
    stubOsrm("ok");
    const inc = (await api().post("/api/incidents").set(B(citizenToken)).send({ title: "Rooftop rescue needed urgently", type: "FLOOD", severity: "HIGH", description: "Family on rooftop as water rises around the house", location: "Lotus Lane", area: "North District", latitude: 28.614, longitude: 77.21, peopleAffected: 5 })).body.data;
    const res = await api().get(`/api/incidents/${inc.id}/dispatch`).set(B(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("osrm");
    expect(res.body.data.ranked).toHaveLength(2);
    expect(res.body.data.ranked[0].profileId).toBe(nearProfile);
    expect(res.body.data.ranked[0].durationMinutes).toBeGreaterThan(0);
    expect(res.body.data.ranked[0].durationMinutes).toBeLessThan(res.body.data.ranked[1].durationMinutes);
    expect(res.body.data.ranked[1].profileId).toBe(farProfile);
    expect(res.body.data.unranked.map((u: { unitName: string }) => u.unitName)).toContain("Unlocated Unit");
  });
  it("returns the driving route geometry for the map", async () => {
    stubOsrm("ok");
    const list = await api().get("/api/incidents?limit=1").set(B(adminToken));
    const incId = list.body.data[0].id as string;
    const res = await api().get(`/api/incidents/${incId}/route?unit=${nearProfile}`).set(B(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.durationMinutes).toBe(11);
    expect(res.body.data.geometry.type).toBe("LineString");
    expect(res.body.data.geometry.coordinates.length).toBeGreaterThanOrEqual(3);
  });
  it("falls back to labelled straight-line estimates when OSRM is down", async () => {
    stubOsrm("down");
    const sos = (await api().post("/api/sos").set(B(citizenToken)).send({ need: "Need evacuation from flooded street", category: "FLOOD", people: 3, location: "Lotus Lane", area: "North District", latitude: 28.7, longitude: 77.26 })).body.data;
    const res = await api().get(`/api/sos/${sos.id}/dispatch`).set(B(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("straight-line-fallback");
    expect(res.body.data.ranked[0].durationMinutes).toBeNull();
    expect(res.body.data.ranked[0].profileId).toBe(nearProfile);
  });
  it("refuses to rank a report without coordinates", async () => {
    stubOsrm("ok");
    const sos = (await api().post("/api/sos").set(B(citizenToken)).send({ need: "Need help but no location pin shared", category: "OTHER", people: 1, location: "Somewhere in the district" })).body.data;
    const res = await api().get(`/api/sos/${sos.id}/dispatch`).set(B(adminToken));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no coordinates/i);
  });
});
