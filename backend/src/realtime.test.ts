import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { io as ioClient, type Socket } from "socket.io-client";
import { app } from "./app";
import { clearDb, disconnectDb } from "./test/db";
import { NotificationModel, UserModel } from "./models";
import { initSocket } from "./socket";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let server: HttpServer; let base = "";
let adminToken = "", citizenToken = "", citizen2Token = "", responderToken = "", profileId = "", citizenId = "";
const sockets: Socket[] = [];

function connect(token?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioClient(base, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false });
    sockets.push(s);
    s.on("connected", () => resolve(s));
    s.on("connect_error", (err) => reject(err));
    setTimeout(() => reject(new Error("connect timeout")), 5000);
  });
}
function connectError(token?: string): Promise<Error> {
  return new Promise((resolve) => {
    const s = ioClient(base, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false });
    sockets.push(s);
    s.on("connect_error", (err) => resolve(err));
    s.on("connected", () => resolve(new Error("unexpectedly connected")));
    setTimeout(() => resolve(new Error("no error within timeout")), 5000);
  });
}
function waitEvent<T>(socket: Socket, event: string, timeout = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
    socket.once(event, (payload: T) => { clearTimeout(timer); resolve(payload); });
  });
}
async function expectNoEvent(socket: Socket, event: string, ms = 700) {
  let seen = false;
  socket.once(event, () => { seen = true; });
  await new Promise((r) => setTimeout(r, ms));
  expect(seen).toBe(false);
}

beforeAll(async () => {
  await clearDb();
  const reg = await api().post("/api/auth/register").send({ name: "RT Citizen", email: "rt@test.local", password: "Citizen@12345", area: "North District" });
  citizenToken = reg.body.data.token; citizenId = reg.body.data.user.id;
  citizen2Token = (await api().post("/api/auth/register").send({ name: "RT Citizen Two", email: "rt2@test.local", password: "Citizen@12345", area: "South District" })).body.data.token;
  await api().post("/api/auth/register").send({ name: "RT Admin", email: "rtadmin@test.local", password: "Admin@12345", role: "ADMIN" });
  await UserModel.updateOne({ email: "rtadmin@test.local" }, { $set: { status: "ACTIVE" } });
  adminToken = (await api().post("/api/auth/login").send({ email: "rtadmin@test.local", password: "Admin@12345" })).body.data.token;
  const unit = await api().post("/api/responders").set(B(adminToken)).send({ email: "rtunit@test.local", name: "RT Unit", password: "Responder@12345", unitName: "RT Rescue 1", unitType: "Rescue", base: "Base", members: 4 });
  profileId = unit.body.data.id;
  responderToken = (await api().post("/api/auth/login").send({ email: "rtunit@test.local", password: "Responder@12345" })).body.data.token;
  server = createServer(app);
  initSocket(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await new Promise<void>((r) => server.close(() => r()));
  await disconnectDb();
});

describe("socket authentication", () => {
  it("rejects unauthenticated connections", async () => {
    const err = await connectError();
    expect(err.message).toMatch(/Authentication required/);
  });
  it("rejects a token that was invalidated by logout", async () => {
    // Throwaway account: logout bumps tokenVersion, so never reuse a shared fixture token here.
    const reg = await api().post("/api/auth/register").send({ name: "RT Throwaway", email: "rtthrow@test.local", password: "Citizen@12345", area: "North District" });
    const oldToken = reg.body.data.token as string;
    await api().post("/api/auth/logout").set(B(oldToken));
    const err = await connectError(oldToken);
    expect(err.message).toMatch(/Authentication required|invalidated/i);
  });
});

describe("role-restricted realtime events + notifications", () => {
  it("SOS created reaches responders, not other citizens; acknowledgement notifies the citizen (socket + DB)", async () => {
    const responderSocket = await connect(responderToken);
    const citizenSocket = await connect(citizenToken);
    const citizen2Socket = await connect(citizen2Token);
    const sosPromise = waitEvent<{ id: string; need: string }>(responderSocket, "sos:created");
    const created = await api().post("/api/sos").set(B(citizenToken)).send({ need: "Realtime SOS test", category: "FLOOD", people: 2, location: "RT Street" });
    const sos = await sosPromise;
    expect(sos.id).toBe(created.body.data.id);
    await expectNoEvent(citizen2Socket, "sos:created");
    await expectNoEvent(citizenSocket, "sos:created");

    const notifPromise = waitEvent<{ title: string }>(citizenSocket, "notification:new");
    const ack = await api().patch(`/api/sos/${sos.id}/status`).set(B(responderToken)).send({ status: "ACKNOWLEDGED" });
    expect(ack.status).toBe(200);
    const notif = await notifPromise;
    expect(notif.title).toBe("SOS acknowledged");
    const dbNotif = await NotificationModel.findOne({ userId: citizenId, title: "SOS acknowledged" });
    expect(dbNotif).not.toBeNull();
    expect(dbNotif!.isRead).toBe(false);
    const read = await api().patch(`/api/notifications/${dbNotif!.id}/read`).set(B(citizenToken));
    expect(read.status).toBe(200); expect(read.body.data.isRead).toBe(true);
  });

  it("incident assignment reaches the responder (event + notification) but not unrelated citizens", async () => {
    const responderSocket = await connect(responderToken);
    const citizen2Socket = await connect(citizen2Token);
    const inc = await api().post("/api/incidents").set(B(citizenToken)).send({ title: "Realtime incident", type: "FLOOD", severity: "HIGH", description: "Incident used to test assignment realtime events.", location: "RT Avenue", area: "North District" });
    const assignedPromise = waitEvent<{ incidentId: string }>(responderSocket, "incident:assigned");
    const notifPromise = waitEvent<{ title: string }>(responderSocket, "notification:new");
    const assign = await api().post(`/api/incidents/${inc.body.data.id}/assign`).set(B(adminToken)).send({ responderProfileId: profileId });
    expect(assign.status).toBe(201);
    const assigned = await assignedPromise;
    expect(assigned.incidentId).toBe(inc.body.data.id);
    const notif = await notifPromise;
    expect(notif.title).toBe("New incident assignment");
    await expectNoEvent(citizen2Socket, "incident:assigned");
  });

  it("new ACTIVE alert broadcasts to citizens and creates their notification", async () => {
    const citizenSocket = await connect(citizenToken);
    const alertPromise = waitEvent<{ title: string }>(citizenSocket, "alert:created");
    const notifPromise = waitEvent<{ title: string; type: string }>(citizenSocket, "notification:new");
    const created = await api().post("/api/alerts").set(B(adminToken)).send({ title: "Realtime flood alert", type: "Weather", severity: "HIGH", area: "North District", instructions: "Stay away from the riverbank and keep phones charged.", status: "ACTIVE" });
    expect(created.status).toBe(201);
    const alert = await alertPromise;
    expect(alert.title).toBe("Realtime flood alert");
    const notif = await notifPromise;
    expect(notif.type).toBe("ALERT");
  });

  it("shelter updates broadcast to citizens", async () => {
    const citizenSocket = await connect(citizenToken);
    const shelter = await api().post("/api/shelters").set(B(adminToken)).send({ name: "RT Shelter", address: "1 RT Road", area: "North District", capacity: 50, occupied: 10 });
    const updatePromise = waitEvent<{ id: string; occupied: number }>(citizenSocket, "shelter:updated");
    const updated = await api().patch(`/api/shelters/${shelter.body.data.id}`).set(B(adminToken)).send({ occupied: 20 });
    expect(updated.status).toBe(200);
    const evt = await updatePromise;
    expect(evt.id).toBe(shelter.body.data.id);
    expect(evt.occupied).toBe(20);
  });

  it("analytics overview exposes the new computations", async () => {
    const r = await api().get("/api/analytics/overview").set(B(adminToken));
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.incidents.trends14Days).toHaveLength(14);
    expect(d.sos.pending).toBeGreaterThanOrEqual(1);
    expect(d.response.avgAcknowledgementMinutes.sos).not.toBeNull();
    expect(Array.isArray(d.shelters.perShelter)).toBe(true);
    expect(d.shelters.perShelter[0]).toHaveProperty("utilizationPercent");
    expect(Array.isArray(d.responderWorkload)).toBe(true);
    expect(d.responderWorkload.some((w: { unitName: string }) => w.unitName === "RT Rescue 1")).toBe(true);
  });
});
