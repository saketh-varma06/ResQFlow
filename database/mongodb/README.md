# @resqflow/mongodb-layer — PREPARED, NOT CONNECTED

> **Status: this layer is PREPARED, NOT CONNECTED.**
> No MongoDB Atlas cluster, database user, or credentials exist for this
> project yet. There is **no connection string** anywhere in this package —
> none has been created, and none may be invented. The running ResQFlow
> backend uses **PostgreSQL via Prisma** (`DATABASE_URL`) and does **not**
> import this package. Nothing here changes the running application.

This package is a code-ready Mongoose layer for a *future* migration from
PostgreSQL to MongoDB Atlas, prepared ahead of time so the migration is a
planned, verifiable step instead of a rewrite. The full design — field
mappings, index list, design decisions, and the migration/rollback plan —
is in [`docs/DATABASE_DESIGN.md`](../../docs/DATABASE_DESIGN.md) (Part 2).

## Contents

```
src/
  connect.ts       connectMongo() / disconnectMongo() — single shared
                   connection, retry with backoff, event logging.
                   Throws "MONGODB_URI is not set — Atlas not connected
                   (preparation only)" when MONGODB_URI is unset/empty.
  health.ts        mongoHealth() → { connected, readyState, message };
                   never throws; confirms liveness with an admin ping.
  models/
    enums.ts       Enum value lists copied 1:1 from the Prisma schema.
    geoPoint.ts    Shared GeoJSON Point sub-schema + toGeoPoint() helper.
    User.ts            → collection `users`
    Responder.ts       → collection `responders`
    Incident.ts        → collection `incidents`      (2dsphere on location)
    SosRequest.ts      → collection `sosRequests`    (2dsphere on location)
    Shelter.ts         → collection `shelters`       (2dsphere on location)
    Alert.ts           → collection `alerts`
    Notification.ts    → collection `notifications`
    Assignment.ts      → collection `assignments`
    StatusHistory.ts   → collection `statusHistory`  (unifies the two
                                                        Prisma history models)
    AuditLog.ts        → collection `auditLogs`
    index.ts         Barrel export for all models.
  index.ts         Package entry: connect + health + models.
```

## Verify the layer (no Atlas needed)

```bash
cd database/mongodb
npm install
npm run typecheck   # tsc --noEmit — must pass
```

## What the user must provide tomorrow (before anything can connect)

1. **An Atlas cluster** (any tier; a free M0 cluster is enough to start),
   in a region reasonably close to the deployment.
2. **A database user** for the application, with `readWrite` on the
   `resqflow` database only — not an Atlas account login, and not
   `atlasAdmin`.
3. **Network access**: the deployment/migration host's IP address added to
   the cluster's IP Access List (or the agreed VPC/peering arrangement).
4. **The connection string**, supplied through the secure credential flow
   (never pasted into chat, never committed) and set as the environment
   variable:

   ```
   MONGODB_URI=mongodb+srv://<db-user>:<password>@<cluster-host>/resqflow?retryWrites=true&w=majority
   ```

   (shape only — the real value comes from Atlas when the cluster exists.)

## Exact cutover steps (summary — full plan in DATABASE_DESIGN.md §2.10)

1. Set `MONGODB_URI` in the target environment; confirm
   `mongoHealth()` reports `connected: true` (admin ping ok).
2. Export all data from PostgreSQL (Prisma/JSON export; record per-table
   row counts). PostgreSQL keeps serving the app throughout.
3. Transform: preserve cuid ids as string `_id`s; `location` text →
   `locationText`; build GeoJSON `location` points from latitude/longitude;
   merge the two status-history tables into `statusHistory` with
   `entityType`; validate every document against these Mongoose schemas.
4. Create indexes (`createIndexes()` from these models) and import into
   Atlas in dependency order: users → responders → incidents → sosRequests
   → shelters → alerts → notifications → assignments → statusHistory →
   auditLogs.
5. Verify: per-collection counts equal the PostgreSQL counts; field-level
   spot checks; orphan-reference check; nearby-shelter `$near`/`$geoNear`
   query returns distance-sorted results; backend test suite passes against
   MongoDB in staging.
6. Cut over by configuration only: deploy the Mongo-backed backend build
   with `MONGODB_URI` set, in a maintenance window, after a final
   incremental export (or brief write freeze).
7. **Rollback:** PostgreSQL is never modified or dropped by this plan. If
   verification or the production window fails, revert the configuration to
   the PostgreSQL build (`DATABASE_URL`) — PostgreSQL remained the system of
   record until the verified switch.
