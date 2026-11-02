import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { clearDb, disconnectDb } from "./test/db";
import { UserModel } from "./models";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let citizenA = "", citizenB = "", responderToken = "", reportId = "";

beforeAll(async () => {
  await clearDb();
  citizenA = (await api().post("/api/auth/register").send({ name: "Asha Reporter", email: "asha@test.local", password: "Citizen@12345", area: "North District" })).body.data.token;
  citizenB = (await api().post("/api/auth/register").send({ name: "Other Citizen", email: "other@test.local", password: "Citizen@12345", area: "South District" })).body.data.token;
  await api().post("/api/auth/register").send({ name: "Tracing Admin", email: "tadmin@test.local", password: "Admin@12345", role: "ADMIN" });
  await UserModel.updateOne({ email: "tadmin@test.local" }, { $set: { status: "ACTIVE" } });
  const adminToken = (await api().post("/api/auth/login").send({ email: "tadmin@test.local", password: "Admin@12345" })).body.data.token;
  await api().post("/api/responders").set(B(adminToken)).send({ email: "tracer@test.local", name: "Tracing Officer", password: "Responder@12345", unitName: "Tracing Team", unitType: "Search", base: "HQ", members: 4 });
  responderToken = (await api().post("/api/auth/login").send({ email: "tracer@test.local", password: "Responder@12345" })).body.data.token;
});
afterAll(async () => { await disconnectDb(); });

describe("Stage G — missing persons privacy", () => {
  it("files a report and shows it only to its reporter", async () => {
    const created = await api().post("/api/missing-persons").set(B(citizenA)).send({ fullName: "Ravi Kumar", ageApprox: 68, lastSeenLocation: "Old Town Market", area: "North District", reporterRelationship: "Daughter", reporterPhone: "+919811111111", circumstances: "Went to the market during the flooding and has not returned" });
    expect(created.status).toBe(201);
    reportId = created.body.data.id;
    expect(created.body.data.status).toBe("REPORTED");
    const mine = await api().get("/api/missing-persons?mine=true").set(B(citizenA));
    expect(mine.body.data).toHaveLength(1);
    const others = await api().get("/api/missing-persons").set(B(citizenB));
    expect(others.body.data).toHaveLength(0);
    const peek = await api().get(`/api/missing-persons/${reportId}`).set(B(citizenB));
    expect(peek.status).toBe(404); // existence itself is not confirmed to strangers
    const own = await api().get(`/api/missing-persons/${reportId}`).set(B(citizenA));
    expect(own.status).toBe(200);
    expect(own.body.data.reporterPhone).toBe("+919811111111");
  });
  it("requires sign-in", async () => {
    expect((await api().get("/api/missing-persons")).status).toBe(401);
  });
  it("staff can search the registry including contact details", async () => {
    const res = await api().get("/api/missing-persons?q=ravi").set(B(responderToken));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].reporterPhone).toBe("+919811111111");
    expect(res.body.data[0].reporter.name).toBe("Asha Reporter");
  });
});

describe("Stage G — tracing workflow", () => {
  it("citizens cannot change statuses", async () => {
    expect((await api().patch(`/api/missing-persons/${reportId}/status`).set(B(citizenA)).send({ status: "SEARCHING" })).status).toBe(403);
  });
  it("marking found requires a resolution note; the reporter is notified", async () => {
    const noNote = await api().patch(`/api/missing-persons/${reportId}/status`).set(B(responderToken)).send({ status: "FOUND_ALIVE" });
    expect(noNote.status).toBe(400);
    const found = await api().patch(`/api/missing-persons/${reportId}/status`).set(B(responderToken)).send({ status: "FOUND_ALIVE", resolutionNote: "Located at Central Sports Complex shelter; family informed by phone" });
    expect(found.status).toBe(200);
    expect(found.body.data.status).toBe("FOUND_ALIVE");
    const mine = await api().get("/api/missing-persons?mine=true").set(B(citizenA));
    expect(mine.body.data[0].resolutionNote).toMatch(/Central Sports Complex/);
    const notifs = await api().get("/api/notifications?limit=20").set(B(citizenA));
    expect(JSON.stringify(notifs.body.data)).toMatch(/found alive/i);
  });
});
