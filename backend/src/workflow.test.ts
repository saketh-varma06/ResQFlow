import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { clearDb, disconnectDb } from "./test/db";
import { UserModel } from "./models";
import { computePriority } from "./utils/priority";
import { assertTransition } from "./utils/workflow";

const api = () => request(app);
const B = (t: string) => ({ Authorization: `Bearer ${t}` });
let adminToken = "", citizenToken = "", responderToken = "", profileId = "";

beforeAll(async () => {
  await clearDb();
  const reg = await api().post("/api/auth/register").send({ name: "Flow Citizen", email: "flow@test.local", password: "Citizen@12345", area: "North District" });
  citizenToken = reg.body.data.token;
  await api().post("/api/auth/register").send({ name: "Flow Admin", email: "flowadmin@test.local", password: "Admin@12345", role: "ADMIN" });
  await UserModel.updateOne({ email: "flowadmin@test.local" }, { $set: { status: "ACTIVE" } });
  adminToken = (await api().post("/api/auth/login").send({ email: "flowadmin@test.local", password: "Admin@12345" })).body.data.token;
  const unit = await api().post("/api/responders").set(B(adminToken)).send({ email: "flowunit@test.local", name: "Flow Unit", password: "Responder@12345", unitName: "Flow Rescue 1", unitType: "Rescue", base: "Base", members: 5 });
  profileId = unit.body.data.id;
  responderToken = (await api().post("/api/auth/login").send({ email: "flowunit@test.local", password: "Responder@12345" })).body.data.token;
});
afterAll(async () => { await disconnectDb(); });

describe("priority scoring (explainable rules)", () => {
  it("scores a severe, trapped, many-people incident as CRITICAL with reasons", () => {
    const r = computePriority({ severity: "CRITICAL", category: "FLOOD", peopleAffected: 340, injuriesReported: 2, trapped: true, submittedAt: new Date() });
    expect(r.level).toBe("CRITICAL"); expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.reasons.join(" ")).toMatch(/Severity critical/);
    expect(r.reasons.join(" ")).toMatch(/trapped/i);
    expect(r.reasons.join(" ")).toMatch(/340 people affected/);
  });
  it("scores a minor single-person report as LOW", () => {
    const r = computePriority({ severity: "LOW", category: "OTHER", peopleAffected: 1, submittedAt: new Date() });
    expect(r.level).toBe("LOW"); expect(r.score).toBeLessThan(30);
  });
  it("uses the category base for SOS (no severity) and adds a waiting bonus over time", () => {
    const fresh = computePriority({ category: "MEDICAL", peopleAffected: 1, submittedAt: new Date() });
    expect(fresh.score).toBe(36); // 35 category + 1 person
    const stale = computePriority({ category: "MEDICAL", peopleAffected: 1, submittedAt: new Date(Date.now() - 3 * 3600 * 1000) });
    expect(stale.score).toBe(46); // +10 waiting cap
    expect(stale.reasons.join(" ")).toMatch(/Waiting 3h/);
  });
  it("transition map rejects skips and allows the documented chain", () => {
    expect(() => assertTransition("SUBMITTED", "RESOLVED")).toThrow(/Invalid status transition/);
    expect(() => assertTransition("SUBMITTED", "ACKNOWLEDGED")).not.toThrow();
    expect(() => assertTransition("ACKNOWLEDGED", "ASSIGNED")).not.toThrow();
    expect(() => assertTransition("ASSIGNED", "IN_PROGRESS")).not.toThrow();
    expect(() => assertTransition("IN_PROGRESS", "RESOLVED")).not.toThrow();
    expect(() => assertTransition("RESOLVED", "CLOSED")).not.toThrow();
    expect(() => assertTransition("CLOSED", "SUBMITTED")).toThrow();
  });
});

describe("full SOS workflow — citizen → admin → responder → citizen", () => {
  it("runs the brief's exact workflow with validated transitions", async () => {
    // 1. Citizen submits SOS with category, trapped info, injuries
    const created = await api().post("/api/sos").set(B(citizenToken)).send({ need: "Family trapped on first floor", category: "TRAPPED", people: 4, injuriesReported: 1, trapped: true, location: "House 9, Riverbank Road", area: "North District" });
    expect(created.status).toBe(201);
    const sos = created.body.data;
    expect(sos.status).toBe("SUBMITTED");
    expect(sos.priorityLevel).toBe("HIGH"); // 35 category + 3 people + 4 injury + 15 trapped = 57
    expect(sos.priorityReasons.join(" ")).toMatch(/trapped/i);
    const id = sos.id as string;

    // 2. Skipping the workflow is rejected (SUBMITTED → RESOLVED)
    const skip = await api().patch(`/api/sos/${id}/status`).set(B(adminToken)).send({ status: "RESOLVED" });
    expect(skip.status).toBe(400); expect(skip.body.error).toMatch(/Invalid status transition/);

    // 3. Responder acknowledges
    const ack = await api().patch(`/api/sos/${id}/status`).set(B(responderToken)).send({ status: "ACKNOWLEDGED" });
    expect(ack.status).toBe(200); expect(ack.body.data.status).toBe("ACKNOWLEDGED");

    // 4. Administrator assigns the responder unit
    const assign = await api().post(`/api/sos/${id}/assign`).set(B(adminToken)).send({ responderProfileId: profileId });
    expect(assign.status).toBe(200); expect(assign.body.data.status).toBe("ASSIGNED");

    // 5. Responder updates progress, then resolves
    const prog = await api().patch(`/api/sos/${id}/status`).set(B(responderToken)).send({ status: "IN_PROGRESS" });
    expect(prog.status).toBe(200);
    const resolved = await api().patch(`/api/sos/${id}/status`).set(B(responderToken)).send({ status: "RESOLVED" });
    expect(resolved.status).toBe(200); expect(resolved.body.data.status).toBe("RESOLVED");

    // 6. Citizen sees the updated status and the full response history
    const mine = await api().get(`/api/sos/${id}`).set(B(citizenToken));
    expect(mine.status).toBe(200); expect(mine.body.data.status).toBe("RESOLVED");
    const chain = (mine.body.data.statusHistory as { toStatus: string }[]).map((h) => h.toStatus);
    expect(chain).toEqual(["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"]);

    // 7. Audit trail holds the assignment + status changes
    const audit = await api().get("/api/audit-logs?action=sos.assign").set(B(adminToken));
    expect(audit.body.meta.total).toBeGreaterThanOrEqual(1);
    const auditStatus = await api().get("/api/audit-logs?action=sos.status_change").set(B(adminToken));
    expect(auditStatus.body.meta.total).toBeGreaterThanOrEqual(3);
  });

  it("citizen can cancel their own submitted SOS; closed records reject further transitions", async () => {
    const created = await api().post("/api/sos").set(B(citizenToken)).send({ need: "Cancel test", category: "OTHER", people: 1, location: "Somewhere" });
    const id = created.body.data.id as string;
    const cancel = await api().patch(`/api/sos/${id}/status`).set(B(citizenToken)).send({ status: "CANCELLED" });
    expect(cancel.status).toBe(200);
    const after = await api().patch(`/api/sos/${id}/status`).set(B(adminToken)).send({ status: "ACKNOWLEDGED" });
    expect(after.status).toBe(400);
  });

  it("incidents follow the same validated workflow", async () => {
    const created = await api().post("/api/incidents").set(B(citizenToken)).send({ title: "Workflow incident", type: "FIRE", severity: "HIGH", description: "Incident used to verify the shared status workflow rules.", location: "Workflow Street", area: "North District", peopleAffected: 10, injuriesReported: 0, trapped: false });
    const id = created.body.data.id as string;
    expect(created.body.data.status).toBe("SUBMITTED");
    const skip = await api().patch(`/api/incidents/${id}/status`).set(B(adminToken)).send({ status: "RESOLVED" });
    expect(skip.status).toBe(400);
    const ack = await api().patch(`/api/incidents/${id}/status`).set(B(adminToken)).send({ status: "ACKNOWLEDGED" });
    expect(ack.status).toBe(200);
  });
});
