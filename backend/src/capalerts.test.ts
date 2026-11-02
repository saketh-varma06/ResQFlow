import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { clearDb, disconnectDb } from "./test/db";
import { UserModel } from "./models";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let adminToken = "", northCitizen = "", subCitizen = "", pickyCitizen = "", radiusCitizen = "";

async function registerCitizen(name: string, email: string, area: string) {
  const r = await api().post("/api/auth/register").send({ name, email, password: "Citizen@12345", area });
  return r.body.data.token as string;
}
async function notificationsFor(token: string) {
  const r = await api().get("/api/notifications?limit=50").set(B(token));
  return (r.body.data as Array<{ title: string }>).map((n) => n.title);
}

beforeAll(async () => {
  await clearDb();
  northCitizen = await registerCitizen("North Citizen", "north@test.local", "North District");
  subCitizen = await registerCitizen("Sub Citizen", "sub@test.local", "South District");
  pickyCitizen = await registerCitizen("Picky Citizen", "picky@test.local", "South District");
  radiusCitizen = await registerCitizen("Radius Citizen", "radius@test.local", "West District");
  await api().post("/api/auth/register").send({ name: "CAP Admin", email: "capadmin@test.local", password: "Admin@12345", role: "ADMIN" });
  await UserModel.updateOne({ email: "capadmin@test.local" }, { $set: { status: "ACTIVE" } });
  adminToken = (await api().post("/api/auth/login").send({ email: "capadmin@test.local", password: "Admin@12345" })).body.data.token;
});
afterAll(async () => { await disconnectDb(); });

describe("Stage B — alert subscriptions + matching", () => {
  it("validates subscription shapes", async () => {
    const bad = await api().post("/api/alerts/subscriptions").set(B(subCitizen)).send({ mode: "RADIUS" });
    expect(bad.status).toBe(400);
    const ok = await api().post("/api/alerts/subscriptions").set(B(subCitizen)).send({ mode: "DISTRICT", area: "East District" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.mode).toBe("DISTRICT");
    const list = await api().get("/api/alerts/subscriptions").set(B(subCitizen));
    expect(list.body.data).toHaveLength(1);
  });
  it("a DISTRICT subscription delivers alerts outside the citizen's home district", async () => {
    const alert = await api().post("/api/alerts").set(B(adminToken)).send({ title: "East District flood warning", type: "Flood", severity: "HIGH", area: "East District", instructions: "Avoid low-lying roads near the river and move to higher ground.", status: "ACTIVE" });
    expect(alert.status).toBe(201);
    expect(alert.body.data.reach).toBeGreaterThanOrEqual(1);
    expect(await notificationsFor(subCitizen)).toContain("East District flood warning");
    expect(await notificationsFor(northCitizen)).not.toContain("East District flood warning");
  });
  it("minSeverity filters weaker alerts out", async () => {
    await api().post("/api/alerts/subscriptions").set(B(pickyCitizen)).send({ mode: "DISTRICT", area: "East District", minSeverity: "CRITICAL" });
    await api().post("/api/alerts").set(B(adminToken)).send({ title: "East District moderate rain notice", type: "Rain", severity: "MODERATE", area: "East District", instructions: "Carry rain protection and expect local waterlogging in low areas.", status: "ACTIVE" });
    expect(await notificationsFor(pickyCitizen)).not.toContain("East District moderate rain notice");
    expect(await notificationsFor(subCitizen)).toContain("East District moderate rain notice");
  });
  it("RADIUS subscriptions match by distance, not district", async () => {
    await api().post("/api/alerts/subscriptions").set(B(radiusCitizen)).send({ mode: "RADIUS", centerLat: 28.61, centerLng: 77.2, radiusKm: 5 });
    await api().post("/api/alerts").set(B(adminToken)).send({ title: "River level rising near Lotus Lane", type: "Flood", severity: "HIGH", area: "Central District", instructions: "Stay away from the riverbank and follow official guidance.", status: "ACTIVE", centerLat: 28.615, centerLng: 77.205, radiusKm: 2 });
    expect(await notificationsFor(radiusCitizen)).toContain("River level rising near Lotus Lane");
    await api().post("/api/alerts").set(B(adminToken)).send({ title: "Far away coastal storm alert", type: "Storm", severity: "HIGH", area: "Central District", instructions: "Secure loose objects and avoid the seafront promenade area.", status: "ACTIVE", centerLat: 13.08, centerLng: 80.27, radiusKm: 5 });
    expect(await notificationsFor(radiusCitizen)).not.toContain("Far away coastal storm alert");
  });
  it("subscriptions can be removed", async () => {
    const list = await api().get("/api/alerts/subscriptions").set(B(subCitizen));
    const del = await api().delete(`/api/alerts/subscriptions/${list.body.data[0].id}`).set(B(subCitizen));
    expect(del.status).toBe(200);
    expect((await api().get("/api/alerts/subscriptions").set(B(subCitizen))).body.data).toHaveLength(0);
  });
});

describe("Stage B — CAP 1.2 export", () => {
  it("exports one alert as CAP XML with mapped severity and circle", async () => {
    const created = await api().post("/api/alerts").set(B(adminToken)).send({ title: "Cyclone landfall expected tonight", type: "Cyclone", severity: "CRITICAL", area: "All districts", instructions: "Stay indoors, charge phones, and keep emergency supplies ready.", status: "ACTIVE", headline: "Cyclone landfall tonight", capCategory: "Met", capUrgency: "Immediate", capCertainty: "Likely", centerLat: 20.1, centerLng: 86.4, radiusKm: 120 });
    const id = created.body.data.id as string;
    const res = await api().get(`/api/alerts/${id}/cap.xml`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/cap\+xml|xml/);
    expect(res.text).toContain("<category>Met</category>");
    expect(res.text).toContain("<severity>Extreme</severity>");
    expect(res.text).toContain("<urgency>Immediate</urgency>");
    expect(res.text).toContain("<headline>Cyclone landfall tonight</headline>");
    expect(res.text).toContain("<circle>20.1,86.4 120</circle>");
    const feed = await api().get("/api/alerts/cap.xml");
    expect(feed.status).toBe(200);
    expect(feed.text).toContain(`resqflow-${id}`);
  });
});

describe("Stage B — Web Push subscription storage", () => {
  it("stores, upserts and removes a push subscription", async () => {
    const payload = { endpoint: "https://push.example.com/sub/abc123", keys: { p256dh: "BP256dhKeyMaterialForTestOnly1234567890", auth: "authSecret123" }, userAgent: "vitest" };
    const first = await api().post("/api/push/subscribe").set(B(northCitizen)).send(payload);
    expect(first.status).toBe(201);
    expect(first.body.data.subscribed).toBe(true);
    const again = await api().post("/api/push/subscribe").set(B(northCitizen)).send(payload);
    expect(again.status).toBe(201);
    expect(again.body.data.id).toBe(first.body.data.id);
    const removed = await api().post("/api/push/unsubscribe").set(B(northCitizen)).send({ endpoint: payload.endpoint });
    expect(removed.body.data.subscribed).toBe(false);
    const key = await api().get("/api/push/vapid-public-key").set(B(northCitizen));
    expect(key.status).toBe(200);
    expect("publicKey" in key.body.data).toBe(true);
  });
});
