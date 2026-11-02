import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { clearDb, disconnectDb } from "./test/db";
import { UserModel } from "./models";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let adminToken = "", citizenA = "", citizenB = "", shelterId = "";

beforeAll(async () => {
  await clearDb();
  citizenA = (await api().post("/api/auth/register").send({ name: "Generous Donor", email: "donor@test.local", password: "Citizen@12345", area: "North District" })).body.data.token;
  citizenB = (await api().post("/api/auth/register").send({ name: "Observer Citizen", email: "observer@test.local", password: "Citizen@12345", area: "South District" })).body.data.token;
  await api().post("/api/auth/register").send({ name: "Donation Admin", email: "dnadmin@test.local", password: "Admin@12345", role: "ADMIN" });
  await UserModel.updateOne({ email: "dnadmin@test.local" }, { $set: { status: "ACTIVE" } });
  adminToken = (await api().post("/api/auth/login").send({ email: "dnadmin@test.local", password: "Admin@12345" })).body.data.token;
  shelterId = (await api().post("/api/shelters").set(B(adminToken)).send({ name: "Donation Target Shelter", address: "9 Giving Lane", area: "North District", capacity: 80, occupied: 30 })).body.data.id;
});
afterAll(async () => { await disconnectDb(); });

describe("Stage H — donations", () => {
  let generalId = "", shelterDonationId = "", anonId = "";
  it("records pledges targeted at the fund, a shelter, or an incident", async () => {
    const general = await api().post("/api/donations").set(B(citizenA)).send({ amount: 5000, paymentRef: "UPI123456" });
    expect(general.status).toBe(201);
    generalId = general.body.data.id;
    expect(general.body.data.status).toBe("PLEDGED");
    expect(general.body.data.targetLabel).toBe("General Relief Fund");
    const toShelter = await api().post("/api/donations").set(B(citizenA)).send({ amount: 2500, targetType: "SHELTER", targetId: shelterId });
    expect(toShelter.status).toBe(201);
    shelterDonationId = toShelter.body.data.id;
    expect(toShelter.body.data.targetLabel).toBe("Donation Target Shelter");
    expect((await api().post("/api/donations").set(B(citizenA)).send({ amount: 100, targetType: "SHELTER" })).status).toBe(400);
    expect((await api().post("/api/donations").set(B(citizenA)).send({ amount: 100, targetType: "SHELTER", targetId: "doesnotexist123" })).status).toBe(404);
  });
  it("the public ledger shows nothing until staff verify receipt", async () => {
    const pub = await api().get("/api/donations").set(B(citizenB));
    expect(pub.body.total).toBe(0);
    const summary = await api().get("/api/donations/summary").set(B(citizenB));
    expect(summary.body.data.receivedTotal).toBe(0);
    expect(summary.body.data.pledgedTotal).toBe(7500);
    const selfVerify = await api().patch(`/api/donations/${generalId}/status`).set(B(citizenA)).send({ status: "RECEIVED" });
    expect(selfVerify.status).toBe(403);
  });
  it("staff verification moves money into the public totals; anonymity is honoured", async () => {
    const anon = await api().post("/api/donations").set(B(citizenA)).send({ amount: 1000, anonymous: true });
    anonId = anon.body.data.id;
    expect((await api().patch(`/api/donations/${generalId}/status`).set(B(adminToken)).send({ status: "RECEIVED" })).status).toBe(200);
    expect((await api().patch(`/api/donations/${anonId}/status`).set(B(adminToken)).send({ status: "RECEIVED" })).status).toBe(200);
    const summary = await api().get("/api/donations/summary").set(B(citizenB));
    expect(summary.body.data.receivedTotal).toBe(6000);
    expect(summary.body.data.receivedCount).toBe(2);
    expect(summary.body.data.donorCount).toBe(1);
    const pub = await api().get("/api/donations?limit=10").set(B(citizenB));
    const names = (pub.body.data as Array<{ donorName: string }>).map((d) => d.donorName).sort();
    expect(names).toEqual(["Anonymous donor", "Generous Donor"]);
    const donorNotif = await api().get("/api/notifications?limit=20").set(B(citizenA));
    expect(JSON.stringify(donorNotif.body.data)).toMatch(/Donation received/);
  });
  it("donors can cancel their own pledges; strangers cannot touch them", async () => {
    const cancel = await api().patch(`/api/donations/${shelterDonationId}/status`).set(B(citizenA)).send({ status: "CANCELLED" });
    expect(cancel.status).toBe(200);
    const summary = await api().get("/api/donations/summary").set(B(adminToken));
    expect(summary.body.data.pledgedTotal).toBe(0);
    const stranger = await api().patch(`/api/donations/${generalId}/status`).set(B(citizenB)).send({ status: "CANCELLED" });
    expect(stranger.status).toBe(403); // not their donation
  });
});
