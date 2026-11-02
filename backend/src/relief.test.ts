import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { clearDb, disconnectDb } from "./test/db";
import { UserModel } from "./models";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let adminToken = "", responderToken = "", citizenToken = "", citizen2Token = "", shelterId = "";

beforeAll(async () => {
  await clearDb();
  citizenToken = (await api().post("/api/auth/register").send({ name: "Donor One", email: "donor1@test.local", password: "Citizen@12345", area: "North District" })).body.data.token;
  citizen2Token = (await api().post("/api/auth/register").send({ name: "Donor Two", email: "donor2@test.local", password: "Citizen@12345", area: "South District" })).body.data.token;
  await api().post("/api/auth/register").send({ name: "Relief Admin", email: "radmin@test.local", password: "Admin@12345", role: "ADMIN" });
  await UserModel.updateOne({ email: "radmin@test.local" }, { $set: { status: "ACTIVE" } });
  adminToken = (await api().post("/api/auth/login").send({ email: "radmin@test.local", password: "Admin@12345" })).body.data.token;
  await api().post("/api/responders").set(B(adminToken)).send({ email: "reliefunit@test.local", name: "Relief Unit", password: "Responder@12345", unitName: "Relief Team 1", unitType: "Logistics", base: "Depot", members: 6 });
  responderToken = (await api().post("/api/auth/login").send({ email: "reliefunit@test.local", password: "Responder@12345" })).body.data.token;
  shelterId = (await api().post("/api/shelters").set(B(adminToken)).send({ name: "Community Hall Shelter", address: "1 Main Road", area: "North District", capacity: 100, occupied: 40 })).body.data.id;
});
afterAll(async () => { await disconnectDb(); });

describe("Stage D — shelter needs + pledges", () => {
  let needId = "", pledge30 = "", pledge70 = "";
  it("staff post a need; citizens cannot", async () => {
    const forbidden = await api().post(`/api/shelters/${shelterId}/needs`).set(B(citizenToken)).send({ item: "Blankets", quantityNeeded: 100 });
    expect(forbidden.status).toBe(403);
    const created = await api().post(`/api/shelters/${shelterId}/needs`).set(B(responderToken)).send({ item: "Blankets", category: "SHELTER_SUPPLIES", quantityNeeded: 100, unit: "pieces" });
    expect(created.status).toBe(201);
    needId = created.body.data.id;
    expect(created.body.data.remaining).toBe(100);
  });
  it("pledges accumulate, over-pledging is refused, fulfilment flips status", async () => {
    const p1 = await api().post(`/api/shelters/${shelterId}/needs/${needId}/pledges`).set(B(citizenToken)).send({ quantity: 30 });
    expect(p1.status).toBe(201);
    pledge30 = p1.body.data.pledge.id;
    expect(p1.body.data.need.quantityPledged).toBe(30);
    expect(p1.body.data.need.remaining).toBe(70);
    const over = await api().post(`/api/shelters/${shelterId}/needs/${needId}/pledges`).set(B(citizen2Token)).send({ quantity: 71 });
    expect(over.status).toBe(400);
    expect(over.body.error).toMatch(/Only 70/);
    const p2 = await api().post(`/api/shelters/${shelterId}/needs/${needId}/pledges`).set(B(citizen2Token)).send({ quantity: 70 });
    pledge70 = p2.body.data.pledge.id;
    expect(p2.body.data.need.status).toBe("FULFILLED");
    const extra = await api().post(`/api/shelters/${shelterId}/needs/${needId}/pledges`).set(B(citizenToken)).send({ quantity: 1 });
    expect(extra.status).toBe(400);
  });
  it("delivery is staff-confirmed; cancellation reopens the need", async () => {
    const selfDeliver = await api().patch(`/api/shelters/pledges/${pledge30}`).set(B(citizenToken)).send({ status: "DELIVERED" });
    expect(selfDeliver.status).toBe(403);
    const delivered = await api().patch(`/api/shelters/pledges/${pledge30}`).set(B(responderToken)).send({ status: "DELIVERED" });
    expect(delivered.status).toBe(200);
    expect(delivered.body.data.status).toBe("DELIVERED");
    const cancelled = await api().patch(`/api/shelters/pledges/${pledge70}`).set(B(citizen2Token)).send({ status: "CANCELLED" });
    expect(cancelled.status).toBe(200);
    const needs = await api().get(`/api/shelters/${shelterId}/needs`).set(B(adminToken));
    const need = (needs.body.data as Array<{ id: string; quantityPledged: number; status: string }>).find((n) => n.id === needId);
    expect(need?.quantityPledged).toBe(30);
    expect(need?.status).toBe("OPEN");
  });
  it("citizens see totals but only their own pledge details", async () => {
    const needs = await api().get(`/api/shelters/${shelterId}/needs`).set(B(citizen2Token));
    const need = (needs.body.data as Array<{ pledges: Array<{ donorId: string }> }>)[0];
    expect(need.pledges.every((p) => p.donorId !== undefined)).toBe(true);
    const mine = await api().get(`/api/shelters/${shelterId}/needs`).set(B(citizenToken));
    const donorIds = (mine.body.data as Array<{ pledges: Array<{ donorId: string }> }>)[0].pledges.map((p) => p.donorId);
    expect(donorIds.length).toBe(1); // citizen1 sees only their own (delivered) pledge, not citizen2's
  });
});

describe("Stage D — minimum-needs calculator", () => {
  it("computes Sphere-style estimates from occupancy", async () => {
    const res = await api().get(`/api/shelters/${shelterId}/minimum-needs?days=3`).set(B(citizenToken));
    expect(res.status).toBe(200);
    const items = Object.fromEntries((res.body.data.items as Array<{ key: string; totalForPeriod: number }>).map((i) => [i.key, i.totalForPeriod]));
    expect(items.water).toBe(1800); // 40 people × 15 L × 3 days
    expect(items.food).toBe(120); // 40 × 3 days
    expect(items.blankets).toBe(40);
    expect(items.hygiene).toBe(10); // 10 households × 1 weekly cycle
    expect(res.body.data.assumptions.join(" ")).toMatch(/Sphere/);
  });
  it("rejects absurd day ranges", async () => {
    expect((await api().get(`/api/shelters/${shelterId}/minimum-needs?days=0`).set(B(citizenToken))).status).toBe(400);
    expect((await api().get(`/api/shelters/${shelterId}/minimum-needs?days=31`).set(B(citizenToken))).status).toBe(400);
  });
});
