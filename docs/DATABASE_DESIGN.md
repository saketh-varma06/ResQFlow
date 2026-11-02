# ResQFlow — Database Design (MongoDB Atlas live since 2 Nov 2026; PostgreSQL design kept as history)

> **Status (2 Nov 2026) — CUTOVER EXECUTED:** The running application uses
> **MongoDB Atlas via Mongoose** (`backend/src/models/`, `backend/src/db/mongo.ts`,
> `MONGODB_URI`). The backend was rewired from Prisma/PostgreSQL to Mongoose
> with the HTTP API unchanged (verified: 57/57 backend tests on Atlas, a
> 32-endpoint response-shape diff against the Postgres build with parity after
> two serialiser fixes, 24/24 live E2E checks, restart-persistence confirmed —
> see `docs/TEST_REPORT.md`). Part 1 below is the historical PostgreSQL design
> (kept from git history; `backend/prisma/` was removed from the working
> tree). Part 2 is the MongoDB design as executed, with two deviations from
> the prepared draft, both forced by the API contract:
> 1. **`location` is a string + scalar latitude/longitude** (the contract),
>    not a GeoJSON point. The draft's GeoJSON `location`/`locationText` split
>    (§2.6's 2dsphere design) was dropped; proximity uses bounding-box/range
>    queries over the scalar fields. The standalone layer in
>    `database/mongodb/` was aligned to the same shape.
> 2. **Relation virtuals + a serialiser** (`backend/src/services/serialize.ts`)
>    reproduce the Prisma-shaped JSON exactly (`_id`→`id`, null-filled
>    scalars, populated-only relations, `incidentId`/`sosId` on history rows).

---

# Part 1 — Historical design: PostgreSQL + Prisma (pre-cutover)

Source of truth: `backend/prisma/schema.prisma`. The schema defines
**11 Prisma models**. (Part 2 maps them to **10 MongoDB collections** because
the two identically-shaped status-history models are unified into one
collection — see §2.3.)

## 1.1 Models, fields and relations

All ids are `String @id @default(cuid())`. `createdAt` defaults to `now()`;
`updatedAt` is maintained by Prisma (`@updatedAt`) where present.

### User
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| email | String | `@unique` |
| phone | String? | `@unique` (nullable) |
| name | String | required |
| passwordHash | String | bcrypt hash; never serialised to clients |
| role | UserRole | default `CITIZEN` |
| status | UserStatus | default `ACTIVE` |
| tokenVersion | Int | default 0 — session invalidation, see §1.4 |
| area, address, bloodGroup, medicalNotes | String? | citizen profile extras |

Relations (1-to-many unless noted): `responderProfile` (1-to-1
ResponderProfile), `incidentsReported`, `sosRequests`, `notifications`,
`assignmentsMade`, `statusChanges`, `sosStatusChanges`, `alertsIssued`,
`shelterCreated`, `auditLogs`.
Indexes: `[role]`, `[status]`, `[area]`.

### ResponderProfile
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| userId | String | `@unique`, FK → User, `onDelete: Cascade` |
| unitName, unitType, base | String | required |
| members | Int | default 1 |
| readiness | ResponderReadiness | default `STANDBY` |
| rating | Float? | |
| serviceArea | String? | |

Relations: `user`, `assignments` (IncidentAssignment[]), `sosAssignments`
(SOSRequest[] as assigned responder).
Indexes: `[readiness]`, `[unitType]`.

### Incident
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| title, description, location (place text), area | String | required |
| type | IncidentType | required |
| severity | Severity | required |
| status | IncidentStatus | default `SUBMITTED` |
| latitude, longitude | Float? | both null when the reporter gave no coordinates |
| peopleAffected | Int | default 0 |
| injuriesReported | Int | default 0 |
| trapped | Boolean | default false |
| priorityScore | Int | default 0, 0–100 — see §1.5 |
| priorityLevel | PriorityLevel | default `LOW` |
| priorityReasons | String[] | explainable score breakdown |
| reporterId | String | FK → User, `onDelete: Restrict` |

Relations: `reporter`, `assignments`, `statusHistory`.
Indexes: `[status]`, `[severity]`, `[type]`, `[area]`, `[reporterId]`,
`[createdAt]`, `[priorityLevel]`.

### SOSRequest
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| citizenId | String | FK → User, `onDelete: Cascade` |
| need | String | required — what help is needed |
| category | SOSCategory | default `OTHER` |
| people | Int | default 1 |
| injuriesReported | Int | default 0 |
| trapped | Boolean | default false |
| priorityScore / priorityLevel / priorityReasons | Int / PriorityLevel / String[] | as Incident |
| location (place text) | String | required |
| area | String? | |
| latitude, longitude | Float? | |
| details, phone | String? | |
| status | SOSStatus | default `SUBMITTED` |
| responderProfileId | String? | FK → ResponderProfile, `onDelete: SetNull` |

Relations: `citizen`, `responderProfile`, `statusHistory` (SOSStatusHistory[]).
Indexes: `[status]`, `[citizenId]`, `[createdAt]`, `[priorityLevel]`.

### SOSStatusHistory / IncidentStatusHistory (two models, identical shape)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| sosId / incidentId | String | FK → parent, `onDelete: Cascade` |
| fromStatus | SOSStatus? / IncidentStatus? | null on the creation entry |
| toStatus | SOSStatus / IncidentStatus | required |
| changedById | String | FK → User, `onDelete: Restrict` |
| note | String? | |
| createdAt | DateTime | default `now()`; no `updatedAt` (append-only) |

Indexes: `[sosId, createdAt]` / `[incidentId, createdAt]`, `[changedById]`.

### Shelter
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name, address, area | String | required |
| capacity | Int | app-enforced ≥ 1 |
| occupied | Int | default 0; app-enforced `occupied ≤ capacity` on create **and** update (incl. shrinking capacity below occupancy) → 400 |
| facilities | String[] | |
| accessibility | String? | added in Phase 5 |
| contact | String? | |
| latitude, longitude | Float? | |
| status | ShelterStatus | default `OPEN` |
| createdById | String? | FK → User, `onDelete: SetNull` |

`available` is **not stored** — the service computes `capacity − occupied`
on every response.
Indexes: `[area]`, `[status]`.

### DisasterAlert
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| title, instructions, area | String | required |
| type | String | free-form (not an enum) |
| severity | Severity | required |
| source | String | default `"District Disaster Office"` |
| status | AlertStatus | default `DRAFT` |
| reach | Int | default 0 |
| issuedById | String? | FK → User, `onDelete: SetNull` |
| issuedAt | DateTime | default `now()` |
| expiresAt | DateTime? | |

Indexes: `[status]`, `[area]`, `[severity]`, `[issuedAt]`.

### Notification
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| userId | String | FK → User, `onDelete: Cascade` |
| title, body | String | required |
| type | NotificationType | default `SYSTEM` |
| relatedEntityType, relatedEntityId | String? | polymorphic link kept as a string pair |
| isRead | Boolean | default false |
| createdAt | DateTime | no `updatedAt` |

Indexes: `[userId, isRead]`, `[userId, createdAt]`.

### IncidentAssignment
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| incidentId | String | FK → Incident, `onDelete: Cascade` |
| responderProfileId | String | FK → ResponderProfile, `onDelete: Cascade` |
| assignedById | String | FK → User, `onDelete: Restrict` |
| status | AssignmentStatus | default `PENDING` |
| notes | String? | |
| assignedAt | DateTime | default `now()` |
| respondedAt, completedAt | DateTime? | |

Constraint: `@@unique([incidentId, responderProfileId])`.
Indexes: `[responderProfileId, status]`, `[incidentId]`.

### AuditLog
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| actorId | String? | FK → User, `onDelete: SetNull` |
| actorEmail | String? | denormalised at write time so the trail survives user deletion; also a supported list filter |
| action, targetType | String | required |
| targetId | String? | |
| details | Json? | free-form |
| result | AuditResult | default `SUCCESS` |
| ipAddress | String? | |
| createdAt | DateTime | append-only, no `updatedAt` |

Indexes: `[actorId]`, `[action]`, `[result]`, `[createdAt]`.

## 1.2 Enums (complete list)

| Enum | Values |
|---|---|
| UserRole | CITIZEN, RESPONDER, ADMIN |
| UserStatus | ACTIVE, PENDING, SUSPENDED |
| Severity | CRITICAL, HIGH, MODERATE, LOW |
| IncidentType | FLOOD, FIRE, STORM, LANDSLIDE, INFRASTRUCTURE, UTILITY, MEDICAL, HAZMAT, OTHER |
| IncidentStatus | SUBMITTED, ACKNOWLEDGED, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED |
| SOSStatus | SUBMITTED, ACKNOWLEDGED, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, **CANCELLED** |
| SOSCategory | FLOOD, FIRE, LANDSLIDE, MEDICAL, TRAPPED, INFRASTRUCTURE, OTHER |
| PriorityLevel | CRITICAL, HIGH, MEDIUM, LOW |
| ShelterStatus | OPEN, NEARLY_FULL, FULL, CLOSED |
| AlertStatus | DRAFT, ACTIVE, EXPIRED, CANCELLED |
| NotificationType | ALERT, INCIDENT_UPDATE, SOS_UPDATE, REQUEST_UPDATE, SHELTER, SYSTEM |
| AssignmentStatus | PENDING, ACCEPTED, DECLINED, COMPLETED, CANCELLED |
| ResponderReadiness | AVAILABLE, DEPLOYED, STANDBY, OFF_DUTY |
| AuditResult | SUCCESS, DENIED, WARNING |

Registration rule that depends on `UserStatus`: public registration as
RESPONDER or ADMIN creates the user as `PENDING` with no session; login is
refused (403) until an admin activates the account. Citizens start `ACTIVE`.

## 1.3 Workflow — incident / SOS status lifecycle

One shared lifecycle, enforced server-side (`backend/src/utils/workflow.ts`,
`assertTransition` — an illegal transition is a 400 naming the allowed next
states):

```
SUBMITTED → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
```

Exact transition table (including the non-linear edges):

| From | Allowed next |
|---|---|
| SUBMITTED | ACKNOWLEDGED, CANCELLED, CLOSED |
| ACKNOWLEDGED | ASSIGNED, CANCELLED |
| ASSIGNED | IN_PROGRESS, ACKNOWLEDGED (un-assign / send back) |
| IN_PROGRESS | RESOLVED |
| RESOLVED | CLOSED |
| CLOSED | — (terminal) |
| CANCELLED | — (terminal, SOS only, citizen-initiated) |

`IncidentStatus` has no `CANCELLED`; `SOSStatus` adds it. Every transition
writes a row to the matching status-history model and an audit entry, and
fires the scoped realtime/notification events.

## 1.4 Auth / session design

- Passwords: bcrypt hashes only (`passwordHash`); never returned by any
  serialiser.
- Session: JWT signed with `JWT_SECRET` (default expiry `7d`), delivered as
  an httpOnly `SameSite=Lax` cookie `resqflow_session` (Secure in
  production) **plus** a Bearer token in the response body for API clients.
- **Session invalidation via `tokenVersion`:** the JWT carries a `tv` claim
  equal to the user's `tokenVersion` at issue time. The auth middleware (and
  the Socket.IO handshake, which applies the same check) loads the user and
  rejects the token when `payload.tv !== user.tokenVersion`. **Logout and
  password change increment `tokenVersion`**, which instantly invalidates
  every previously issued token — including live realtime connections.
- CSRF: double-submit cookie (`resqflow_csrf` cookie + `x-csrf-token`
  header) on cookie-authenticated mutations; Bearer-authenticated requests
  are exempt. Login is rate-limited (20 attempts / 15 min).
- RBAC is enforced on the backend per role (CITIZEN / RESPONDER / ADMIN);
  the frontend route guards are a convenience, not the security boundary.

## 1.5 Priority fields

Both `Incident` and `SOSRequest` carry `priorityScore` (Int, 0–100),
`priorityLevel` (PriorityLevel) and `priorityReasons` (String[]). The score
is computed by an explainable rule-based function
(`backend/src/utils/priority.ts`): severity base (incidents) or category
base (SOS), a time-critical category bump, people-affected points (capped
20), +4 per injury (capped 20), +15 when people are trapped, and waiting
time +1 per 15 min (capped 10); level thresholds are CRITICAL ≥ 70,
HIGH ≥ 50, MEDIUM ≥ 30, else LOW. Every contributing rule appends a
human-readable string to `priorityReasons`. It is explicitly a dispatcher
sorting aid, **not** a validated triage algorithm.

## 1.6 Integrity notes

- Referential actions are deliberate: citizens cascade-delete their SOS
  requests and notifications; reporters are `Restrict` on incidents (a user
  who reported an incident cannot be deleted out from under it); optional
  creators/issuers are `SetNull` so shelters, alerts and audit logs survive
  user removal.
- Uniqueness: `User.email`, `User.phone`, `ResponderProfile.userId`,
  `(incidentId, responderProfileId)` on assignments.

---

# Part 2 — MongoDB Atlas design (EXECUTED 2 Nov 2026 — the live design)

Target: MongoDB Atlas cluster, database `resqflow`, accessed with Mongoose 8
via `backend/src/models/` (adapted from the prepared layer in `database/mongodb/`,
which is kept aligned as a standalone reference + verification harness). The design goal is a
**faithful port**: same identifiers, same enum values, same validation
behaviour, so the application logic (workflow, priority, RBAC, realtime
scoping) does not change at cutover — only the data-access layer does.

## 2.1 Mapping overview

| Prisma model (PostgreSQL) | MongoDB collection | Notes |
|---|---|---|
| User | `users` | |
| ResponderProfile | `responders` | separate collection, references users (§2.3) |
| Incident | `incidents` | + GeoJSON `location` |
| SOSRequest | `sosRequests` | + GeoJSON `location` |
| Shelter | `shelters` | + GeoJSON `location` |
| DisasterAlert | `alerts` | |
| Notification | `notifications` | |
| IncidentAssignment | `assignments` | separate collection (§2.3) |
| IncidentStatusHistory **and** SOSStatusHistory | `statusHistory` | unified, `entityType` discriminator (§2.3) |
| AuditLog | `auditLogs` | |

**Identifier strategy:** PostgreSQL cuid strings are preserved verbatim as
the string `_id` of each MongoDB document. No id translation table is
needed, every cross-reference stays valid, and API-visible ids do not change
across the migration. New documents created after cutover get a string id
generated by the application layer (the prepared schemas default `_id` to a
hex ObjectId string; a cuid generator can be substituted without schema
change).

**Reference strategy:** foreign keys become plain string fields holding the
referenced `_id` (e.g. `reporterId`), declared with Mongoose `ref` for
`populate()` but with **no database-level foreign-key enforcement** — MongoDB
has none. Referential discipline (including the Prisma `onDelete`
behaviours in §1.6) must be re-implemented in the service layer at cutover;
the migration verification step (§2.10) checks for orphans.

**Renames for clarity in MongoDB:** the Prisma string field `location`
(human-readable place text) becomes `locationText`, because `location` is
reserved in this design for GeoJSON. The scalar `latitude`/`longitude`
fields are kept alongside the GeoJSON point for parity with existing
serialisers during the transition.

## 2.2 Conventions

- Every field keeps its Prisma name (except `location` → `locationText`),
  type and nullability: `String?` → optional field; `Int` → Number with
  integer semantics enforced in validators where the app does; `Float` →
  Number; `Boolean` → Boolean; `DateTime` → Date; `String[]` → [String];
  `Json?` (AuditLog.details) → Mixed.
- Enums are validated with exactly the Prisma value lists (see
  `database/mongodb/src/models/enums.ts`).
- `createdAt`/`updatedAt` are maintained by Mongoose `timestamps`. Models
  that have no `updatedAt` in Prisma (Notification, both histories,
  AuditLog) use `timestamps: { createdAt: true, updatedAt: false }`.
- JSON Schema validation: the Mongoose schemas in `database/mongodb/` are
  the executable form of the rules below; the same rules should also be
  applied as Atlas-side `$jsonSchema` validators at migration time so
  non-application writers cannot insert invalid documents.

## 2.3 Design decisions (explicit)

### D1 — Responders: separate collection referencing users (chosen) vs embedded profile on the user document
**Chosen: separate `responders` collection, `userId` → `users._id`, unique.**
- Only RESPONDER users have a profile; embedding would leave a null/absent
  sub-document on every citizen and admin.
- Responders are queried independently of accounts: dispatch filters by
  `readiness` and `unitType`, which need their own indexes; embedded data
  cannot be indexed or paginated as cleanly per-responder.
- Assignments and SOS requests reference the *responder*, not the user —
  a top-level id keeps those references unambiguous.
- The 1-to-1 profile is small and stable, so the extra lookup/populate cost
  is negligible; the current Prisma model already treats it as its own
  entity with its own lifecycle (readiness changes via
  `PATCH /api/responders/me/availability` do not touch the user row).
- Embedding was rejected because it would also duplicate profile data into
  every user-shaped payload and couple account updates to dispatch data.

### D2 — Assignments: separate referenced collection (chosen) vs embedded arrays on incidents/responders
**Chosen: separate `assignments` collection.**
- An assignment is a many-to-many join *with its own lifecycle*
  (PENDING → ACCEPTED/DECLINED → COMPLETED/CANCELLED), notes and three
  timestamps (assigned/responded/completed) — it is an entity, not an
  attribute of either parent.
- It is queried from both sides ("my assignments" for a responder;
  "responders on this incident" for dispatch) and must enforce uniqueness
  of `(incidentId, responderProfileId)` — a unique compound index only
  exists on a top-level collection.
- Embedding into incidents would duplicate the same assignment into the
  responder's view (or vice versa) with two copies to keep in sync.

### D3 — Status history: separate referenced collection (chosen) vs embedded array on incidents/SOS
**Chosen: separate `statusHistory` collection**, unifying the two Prisma
history models with an `entityType` discriminator (`INCIDENT` | `SOS`) +
`entityId`.
- History is **append-only and unbounded**: every status change adds an
  entry for the life of the record. Embedding would grow the parent document
  on every change, create write contention on hot incident documents, and
  risk the 16 MB document limit on long-lived incidents.
- Timeline and analytics queries are collection-level: a citizen's tracking
  view reads one entity's history in time order, and the analytics the app
  already computes (average acknowledgement / resolution minutes, trends)
  are aggregations *across* entities — natural on a collection, painful on
  embedded arrays.
- Unification is safe because `IncidentStatusHistory` and
  `SOSStatusHistory` have identical fields; the only difference (CANCELLED
  exists only for SOS) is handled by validating `fromStatus`/`toStatus`
  against the entity's own enum in the application layer (the schema-level
  enum is the union).
- Embedding was rejected for both D2 and D3 for the same root reason:
  **data that grows, is queried independently, or has its own lifecycle
  does not belong inside another document.**

### D4 — Locations: GeoJSON Point + kept scalar pair
Coordinates are stored as a GeoJSON Point in the field named `location`:
`location: { type: "Point", coordinates: [lon, lat] }`, with a **2dsphere**
index. (The PostgreSQL place-*text* field, also called `location` in Prisma,
moves to `locationText` in MongoDB so the name `location` can carry the
GeoJSON point — see §2.1.)
The scalar `latitude`/`longitude` pair is kept during transition for parity
with current API responses; the transform step (§2.10) builds the GeoJSON
point from the pair, and the write path must keep all three in sync.
Records without coordinates omit the point entirely (sparse geospatial
behaviour) — same semantics as the nullable pair today.

### D5 — `available` on shelters stays computed, never stored
As in PostgreSQL, shelter availability is derived (`capacity − occupied`)
at read time. Storing it would create a second source of truth that drifts
on every occupancy update.

### D6 — No denormalised embedding of users into incidents/SOS
Reporter/citizen names are resolved by reference (`populate`/lookup) at
read time, as today. The single deliberate denormalisation kept from the
PostgreSQL design is `auditLogs.actorEmail`, which must survive user
deletion.

## 2.4 Collections — field mapping, types, validation

### users (from `User`)
| Field | Mongo type | Validation / notes |
|---|---|---|
| _id | String | preserved cuid |
| email | String | required, trimmed, lowercased, format-checked, **unique** |
| phone | String? | sparse-unique |
| name | String | required |
| passwordHash | String | required; never serialised |
| role | String enum | UserRole, default CITIZEN |
| status | String enum | UserStatus, default ACTIVE |
| tokenVersion | Number | default 0, min 0 — §1.4 semantics unchanged |
| area, address, bloodGroup, medicalNotes | String? | |
| createdAt, updatedAt | Date | timestamps |

### responders (from `ResponderProfile`)
| Field | Mongo type | Validation / notes |
|---|---|---|
| _id | String | preserved cuid |
| userId | String ref users | required, **unique** |
| unitName, unitType, base | String | required |
| members | Number | default 1, min 1 |
| readiness | String enum | ResponderReadiness, default STANDBY |
| rating | Number? | min 0, max 5 |
| serviceArea | String? | |
| createdAt, updatedAt | Date | timestamps |

### incidents (from `Incident`)
| Field | Mongo type | Validation / notes |
|---|---|---|
| _id | String | preserved cuid |
| title | String | required |
| type | String enum | IncidentType, required |
| severity | String enum | Severity, required |
| status | String enum | IncidentStatus, default SUBMITTED |
| description | String | required |
| locationText | String | required (Prisma `location`) |
| area | String | required |
| latitude / longitude | Number? | lat ∈ [−90, 90], lon ∈ [−180, 180] |
| location | GeoJSON Point? | from (lon, lat) pair; 2dsphere |
| peopleAffected | Number | default 0, min 0 |
| injuriesReported | Number | default 0, min 0 |
| trapped | Boolean | default false |
| priorityScore | Number | default 0, min 0, max 100 |
| priorityLevel | String enum | PriorityLevel, default LOW |
| priorityReasons | [String] | default [] |
| reporterId | String ref users | required |
| createdAt, updatedAt | Date | timestamps |

### sosRequests (from `SOSRequest`)
| Field | Mongo type | Validation / notes |
|---|---|---|
| _id | String | preserved cuid |
| citizenId | String ref users | required |
| need | String | required |
| category | String enum | SOSCategory, default OTHER |
| people | Number | default 1, min 1 |
| injuriesReported | Number | default 0, min 0 |
| trapped | Boolean | default false |
| priorityScore / priorityLevel / priorityReasons | as incidents | |
| locationText | String | required (Prisma `location`) |
| area | String? | |
| latitude / longitude / location | as incidents | 2dsphere |
| details, phone | String? | |
| status | String enum | SOSStatus, default SUBMITTED |
| responderProfileId | String ref responders, null | null when unassigned (SetNull semantics in service layer) |
| createdAt, updatedAt | Date | timestamps |

### shelters (from `Shelter`)
| Field | Mongo type | Validation / notes |
|---|---|---|
| _id | String | preserved cuid |
| name, address, area | String | required |
| capacity | Number | required, min 1, max 1 000 000 |
| occupied | Number | default 0, min 0, **must be ≤ capacity** (document validator — same rule as the current Zod refine + service check, so create and shrink-below-occupancy updates both fail) |
| facilities | [String] | default [] |
| accessibility, contact | String? | |
| latitude / longitude / location | as incidents | 2dsphere |
| status | String enum | ShelterStatus, default OPEN |
| createdById | String ref users, null | |
| createdAt, updatedAt | Date | timestamps |

### alerts (from `DisasterAlert`)
| Field | Mongo type | Validation / notes |
|---|---|---|
| _id | String | preserved cuid |
| title | String | required |
| type | String | required, free-form (no enum — parity with Prisma) |
| severity | String enum | Severity, required |
| area | String | required |
| instructions | String | required |
| source | String | default "District Disaster Office" |
| status | String enum | AlertStatus, default DRAFT |
| reach | Number | default 0, min 0 |
| issuedById | String ref users, null | |
| issuedAt | Date | default now |
| expiresAt | Date? | |
| createdAt, updatedAt | Date | timestamps |

### notifications (from `Notification`)
| Field | Mongo type | Validation / notes |
|---|---|---|
| _id | String | preserved cuid |
| userId | String ref users | required |
| title, body | String | required |
| type | String enum | NotificationType, default SYSTEM |
| relatedEntityType, relatedEntityId | String? | polymorphic pair, as in PostgreSQL |
| isRead | Boolean | default false |
| createdAt | Date | no updatedAt |

### assignments (from `IncidentAssignment`)
| Field | Mongo type | Validation / notes |
|---|---|---|
| _id | String | preserved cuid |
| incidentId | String ref incidents | required |
| responderProfileId | String ref responders | required |
| assignedById | String ref users | required |
| status | String enum | AssignmentStatus, default PENDING |
| notes | String? | |
| assignedAt | Date | default now |
| respondedAt, completedAt | Date? | |
| createdAt, updatedAt | Date | timestamps |
| — | — | **unique** compound (incidentId, responderProfileId) |

### statusHistory (from `IncidentStatusHistory` + `SOSStatusHistory`)
| Field | Mongo type | Validation / notes |
|---|---|---|
| _id | String | preserved cuid |
| entityType | String enum | INCIDENT \| SOS — discriminator (D3) |
| entityId | String | _id of the incident / SOS request |
| fromStatus | String enum \| null | null on creation entry; app layer validates against the entity's own status enum |
| toStatus | String enum | required; union of IncidentStatus + SOSStatus |
| changedById | String ref users | required |
| note | String? | |
| createdAt | Date | append-only, no updatedAt |

### auditLogs (from `AuditLog`)
| Field | Mongo type | Validation / notes |
|---|---|---|
| _id | String | preserved cuid |
| actorId | String ref users, null | null for anonymous/system or deleted actor |
| actorEmail | String? | denormalised at write time (D6) |
| action, targetType | String | required |
| targetId | String? | |
| details | Mixed | from Prisma Json |
| result | String enum | AuditResult, default SUCCESS |
| ipAddress | String? | |
| createdAt | Date | append-only, no updatedAt |

## 2.5 Index list per collection

In addition to the automatic `_id` index. These mirror the Prisma indexes
and add the compounds the application's actual queries use (status queues
sorted by recency, priority queues, per-user feeds).

| Collection | Indexes |
|---|---|
| users | `{ email: 1 }` **unique**; `{ phone: 1 }` unique + sparse; `{ role: 1 }`; `{ status: 1 }`; `{ area: 1 }` |
| responders | `{ userId: 1 }` **unique**; `{ readiness: 1 }`; `{ unitType: 1 }` |
| incidents | `{ status: 1 }`; `{ status: 1, createdAt: -1 }`; `{ severity: 1 }`; `{ type: 1 }`; `{ area: 1 }`; `{ reporterId: 1 }`; `{ createdAt: -1 }`; `{ priorityLevel: 1 }`; `{ priorityLevel: 1, priorityScore: -1, createdAt: 1 }` (dispatch queue); `{ location: "2dsphere" }` |
| sosRequests | `{ status: 1 }`; `{ status: 1, createdAt: -1 }`; `{ citizenId: 1 }`; `{ citizenId: 1, createdAt: -1 }`; `{ createdAt: -1 }`; `{ priorityLevel: 1 }`; `{ responderProfileId: 1 }`; `{ location: "2dsphere" }` |
| shelters | `{ area: 1 }`; `{ status: 1 }`; `{ status: 1, area: 1 }`; `{ location: "2dsphere" }` |
| alerts | `{ status: 1 }`; `{ status: 1, issuedAt: -1 }`; `{ area: 1 }`; `{ severity: 1 }`; `{ issuedAt: -1 }` |
| notifications | `{ userId: 1, isRead: 1 }`; `{ userId: 1, createdAt: -1 }` |
| assignments | `{ incidentId: 1, responderProfileId: 1 }` **unique**; `{ responderProfileId: 1, status: 1 }`; `{ incidentId: 1 }` |
| statusHistory | `{ entityType: 1, entityId: 1, createdAt: 1 }`; `{ entityId: 1, createdAt: 1 }`; `{ changedById: 1 }` |
| auditLogs | `{ actorId: 1 }`; `{ actorEmail: 1 }`; `{ action: 1 }`; `{ result: 1 }`; `{ createdAt: -1 }`; `{ targetType: 1, targetId: 1 }` |

All of the above are declared in the prepared Mongoose schemas
(`database/mongodb/src/models/*.ts`) so `createIndexes()` at migration time
builds exactly this list.

## 2.6 Geospatial design — nearby shelters

Shelter discovery ("shelters near me, closest first, only ones that can
still take people") is the primary geo query; the same pattern serves
nearby incidents / SOS for the operations map.

```js
// $near form — returns documents sorted by ascending distance.
db.shelters.find({
  status: { $in: ["OPEN", "NEARLY_FULL"] },
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [lon, lat] },
      $maxDistance: 10000,          // metres
      $minDistance: 0
    }
  }
}).limit(20)
// `available` (capacity - occupied > 0) is filtered in the aggregation /
// application layer because it is a computed value (D5) — or with an
// $expr stage: { $expr: { $gt: ["$capacity", "$occupied"] } }.
```

```js
// $geoNear aggregation form — when the distance value itself is needed
// (e.g. to display "2.3 km away") or geo must combine with other stages.
db.shelters.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [lon, lat] },
      distanceField: "distanceMeters",
      maxDistance: 10000,
      spherical: true,
      query: { status: { $in: ["OPEN", "NEARLY_FULL"] } }
    }
  },
  { $match: { $expr: { $gt: ["$capacity", "$occupied"] } } },
  { $limit: 20 }
])
```

Rules: coordinates are always `[longitude, latitude]`; `maxDistance` is in
**metres** (spherical 2dsphere); results come back distance-sorted with no
extra sort stage; documents without a `location` never match a geo
query (they remain listable by area, exactly like today's records without
coordinates). The default search radius is an application decision
(suggested 10 km, configurable), not a schema property.

## 2.7 Connection management design

Implemented in `database/mongodb/src/connect.ts`:
- **One** shared Mongoose connection for the whole process
  (`mongoose.connect` once; repeat calls return the existing connection when
  `readyState` is 1 connected / 2 connecting). A small pool
  (`maxPoolSize: 10`) is sufficient for this application's load; the driver
  manages the pool — the app must never open per-request connections.
- The URI comes **only** from `process.env.MONGODB_URI`. If it is unset or
  empty, `connectMongo()` throws
  `MONGODB_URI is not set — Atlas not connected (preparation only)` — there
  is no fallback and no hardcoded URI anywhere in the layer. The URI itself
  is never logged (it embeds credentials).
- Options: `serverSelectionTimeoutMS: 10000`, `retryWrites: true`,
  `w: "majority"`, `strictQuery: true`.
- **Retry:** connect attempts retry up to 3 times with exponential backoff
  (1 s, 2 s, 4 s) before the error propagates. After a successful connect,
  the MongoDB driver itself auto-reconnects replica-set connections;
  `connected` / `disconnected` / `reconnected` / `error` events are logged
  (message only, never credentials).
- `disconnectMongo()` closes the shared connection gracefully at shutdown.
- Atlas-side prerequisites (user's side, §2.10 step 0): a cluster, a
  database user with readWrite on `resqflow` only, and network access
  (IP allowlist) covering the deployment host.

## 2.8 Database health endpoint design

Implemented (unwired) in `database/mongodb/src/health.ts`:
`mongoHealth()` **never throws**. It returns
`{ connected: boolean, readyState: number, message: string }` where
`readyState` is the raw Mongoose state (0 disconnected, 1 connected,
2 connecting, 3 disconnecting). When `readyState === 1` it confirms
liveness with an **admin ping** (`connection.db.admin().ping()`, expecting
`ok: 1`) rather than trusting socket state; any ping failure reports
`connected: false` with the error message.

Proposed endpoint at cutover (alongside, not replacing, the existing
PostgreSQL-backed `GET /api/health`):

```
GET /api/health/db
→ 200 { postgres: {...existing...}, mongodb: { connected, readyState, message } }
```

Until cutover, `mongodb.connected` will honestly report `false` with the
message `MONGODB_URI is not set — Atlas not connected (preparation only)`.
The health route must not fail the whole health check because the
not-yet-migrated store is absent.

## 2.9 What does **not** change at cutover

API routes, request/response shapes, the workflow transition table (§1.3),
priority computation (§1.5), auth/session semantics including `tokenVersion`
(§1.4), CSRF, RBAC, realtime event scoping, and all enum values. The
migration replaces the persistence layer only.

## 2.10 Migration plan (PostgreSQL → Atlas)

**Step 0 — prerequisites (user provides):** Atlas cluster created; database
user with readWrite on `resqflow`; network access allowlist includes the
migration/deployment host; `MONGODB_URI` supplied via the secure credential
flow and set in the environment. Until this happens, nothing below can run
and Atlas must not be described as connected.

**Step 1 — export from PostgreSQL.** While the app keeps running on
PostgreSQL, export every table with Prisma (script using the existing
Prisma client, ordered by dependency) or `COPY ... TO STDOUT (FORMAT CSV)`
/ `pg_dump --data-only --format=custom`. JSON export via Prisma is
preferred because it preserves types (arrays, Json, timestamps) without
CSV quoting hazards. Record the export timestamp and per-table row counts.

**Step 2 — transform.** A one-off script (run against the exported data,
never against the live API):
- `_id` := PostgreSQL `id` (cuid preserved verbatim); all FK fields copied
  unchanged.
- `location` (text) → `locationText`; build `location` :=
  `{ type: "Point", coordinates: [longitude, latitude] }` when both
  coordinates are non-null, omit it otherwise.
- Enums copied unchanged (identical vocabularies); validate every document
  against the Mongoose schemas from `database/mongodb/` and fail the run on
  the first invalid document rather than skipping it.
- `IncidentStatusHistory` and `SOSStatusHistory` rows are merged into
  `statusHistory` with `entityType` set to `INCIDENT` / `SOS` and
  `entityId` := the old `incidentId` / `sosId`.
- Dates → BSON Date; `priorityReasons`, `facilities` arrays copied as-is;
  AuditLog `details` copied as a nested document.

**Step 3 — import into Atlas.** Create the `resqflow` database and
collections with the §2.5 indexes (via the Mongoose models'
`createIndexes()`), apply `$jsonSchema` validators mirroring §2.4, then
bulk-insert in dependency order: users → responders → incidents →
sosRequests → shelters → alerts → notifications → assignments →
statusHistory → auditLogs. Use ordered inserts and log every failure;
a partial import is discarded and re-run from scratch (imports are
idempotent because `_id`s are preserved — re-running upserts by `_id`).

**Step 4 — verification (all must pass before cutover):**
- **Row counts:** `countDocuments()` per collection equals the PostgreSQL
  `COUNT(*)` per table recorded in Step 1 (statusHistory = the sum of the
  two history tables).
- **Spot checks:** a sample of records per collection (including the
  highest-priority open SOS, a shelter with occupancy, an assignment, an
  audit entry with `details`) compared field-by-field between Prisma and
  Mongoose reads.
- **Referential spot check:** no orphan `reporterId`, `citizenId`,
  `userId`, `incidentId`, `responderProfileId`, `entityId` values
  (aggregation `$lookup` / anti-join pass).
- **Behaviour checks:** the §2.6 nearby-shelter query returns distance-sorted
  results; login works against a migrated user (bcrypt hashes carry over
  unchanged); `tokenVersion` values match, so existing sessions behave
  identically.
- **Test suite:** the backend test suite passes against MongoDB in a
  staging environment before any production switch.

**Step 5 — cutover = configuration change, not data destruction.** The
switch is: point the (future, separately built) Mongo-backed backend build
at `MONGODB_URI`, in a maintenance window, after a final incremental export
of anything written to PostgreSQL since Step 1 (or a brief write freeze —
this app's write volume makes a short freeze acceptable). PostgreSQL is
**not** dropped, altered, or decommissioned at cutover.

**Rollback:** PostgreSQL stays live and untouched until the cutover is
verified in production. If anything fails verification (Step 4) or in the
first production window, rollback is simply reverting the configuration to
the PostgreSQL build (`DATABASE_URL`) — no data needs to move back, because
PostgreSQL was the system of record until the verified switch. Any writes
accepted by MongoDB during a failed production window are replayed into
PostgreSQL from the audit log / a reverse export before the revert is
declared complete. Only after a separately agreed stability period would
anyone propose retiring the PostgreSQL instance — and that is a new
decision, not part of this plan.

---

## 2.11 Execution record (2 Nov 2026)

The cutover in §2.10 was executed the same day the Atlas cluster was verified:

- **Baseline first:** 32 normalised endpoint responses captured from the
  running PostgreSQL build; the post-cutover capture was diffed against them.
  Two serialiser defects were found and fixed (StatusHistory entries leaking
  `_id`/`__v`; a null `responderProfile` being dropped for unassigned SOS).
  After the fixes, the same-record comparison is key-for-key identical.
- **Tests:** all 57 backend tests pass against the Atlas `resqflow_test`
  database with zero assertion changes; the harness connects via
  `MONGODB_URI_TEST` (derived from `MONGODB_URI`) and clears collections with
  `deleteMany` between files.
- **Live gates:** 24/24 E2E checks and 5/5 socket-scoping checks passed
  against the Mongo-backed server; records created in the E2E survived a
  backend restart (Atlas persistence); `npm run verify` in
  `database/mongodb/` passes 9/9 with the aligned models.
- **Prisma removed** from the working tree (deps, `backend/prisma/`,
  `src/database/`); it remains in git history at commit `1b711ff` and below.
- **Known cosmetic difference:** list ordering can differ when `createdAt`
  timestamps tie — MongoDB `Date` values have millisecond precision, so rows
  seeded in the same millisecond may order differently than they did under
  PostgreSQL's microsecond timestamps. Real user-created records have
  distinct timestamps; no ordering guarantee existed in the API contract.
