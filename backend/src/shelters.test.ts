import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { clearDb, disconnectDb } from "./test/db";
import { UserModel } from "./models";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let adminToken = "", citizenToken = "", shelterId = "";

beforeAll(async () => {
  await clearDb();
  const reg = await api().post("/api/auth/register").send({ name: "Shelter Citizen", email: "shc@test.local", password: "Citizen@12345" });
  citizenToken = reg.body.data.token;
  await api().post("/api/auth/register").send({ name: "Shelter Admin", email: "sha@test.local", password: "Admin@12345", role: "ADMIN" });
  await UserModel.updateOne({ email: "sha@test.local" }, { $set: { status: "ACTIVE" } });
  adminToken = (await api().post("/api/auth/login").send({ email: "sha@test.local", password: "Admin@12345" })).body.data.token;
});
afterAll(async () => { await disconnectDb(); });

describe("shelter management validation", () => {
  it("creates a shelter with accessibility details and computed available capacity", async () => {
    const r = await api().post("/api/shelters").set(B(adminToken)).send({ name: "Test Hall", address: "1 Test Road", area: "North District", capacity: 100, occupied: 30, facilities: ["Beds", "Food"], accessibility: "Step-free entrance, accessible toilets", latitude: 28.6, longitude: 77.2 });
    expect(r.status).toBe(201);
    expect(r.body.data.available).toBe(70);
    expect(r.body.data.accessibility).toMatch(/Step-free/);
    expect(r.body.data.status).toBe("OPEN");
    shelterId = r.body.data.id;
  });
  it("rejects occupied greater than capacity on create and update", async () => {
    const bad = await api().post("/api/shelters").set(B(adminToken)).send({ name: "Bad Hall", address: "2 Test Road", area: "North District", capacity: 10, occupied: 11 });
    expect(bad.status).toBe(400);
    const badUpdate = await api().patch(`/api/shelters/${shelterId}`).set(B(adminToken)).send({ occupied: 101 });
    expect(badUpdate.status).toBe(400);
  });
  it("rejects shrinking capacity below current occupancy, and capacity below 1", async () => {
    const shrink = await api().patch(`/api/shelters/${shelterId}`).set(B(adminToken)).send({ capacity: 20 });
    expect(shrink.status).toBe(400);
    const zero = await api().post("/api/shelters").set(B(adminToken)).send({ name: "Zero Hall", address: "3 Test Road", area: "North District", capacity: 0 });
    expect(zero.status).toBe(400);
  });
  it("derives NEARLY_FULL and FULL from occupancy and exposes updatedAt", async () => {
    const near = await api().patch(`/api/shelters/${shelterId}`).set(B(adminToken)).send({ occupied: 95 });
    expect(near.body.data.status).toBe("NEARLY_FULL");
    expect(near.body.data.available).toBe(5);
    expect(typeof near.body.data.updatedAt).toBe("string");
    const full = await api().patch(`/api/shelters/${shelterId}`).set(B(adminToken)).send({ occupied: 100 });
    expect(full.body.data.status).toBe("FULL");
    expect(full.body.data.available).toBe(0);
  });
  it("citizens can search shelters but cannot create them", async () => {
    const list = await api().get("/api/shelters?search=Test%20Hall").set(B(citizenToken));
    expect(list.status).toBe(200); expect(list.body.meta.total).toBe(1);
    const create = await api().post("/api/shelters").set(B(citizenToken)).send({ name: "Nope", address: "x", area: "North District", capacity: 5 });
    expect(create.status).toBe(403);
  });
});
