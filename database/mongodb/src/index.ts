/**
 * @resqflow/mongodb-layer — PREPARED, NOT CONNECTED.
 *
 * A code-ready Mongoose layer for ResQFlow's future MongoDB Atlas migration.
 * Nothing in the running application imports this package: the backend runs
 * on PostgreSQL via Prisma today. See README.md in this folder and
 * docs/DATABASE_DESIGN.md for the design and cutover plan.
 */
export { connectMongo, disconnectMongo, mongoose } from "./connect";
export type { ConnectOptions } from "./connect";
export { mongoHealth } from "./health";
export type { MongoHealth } from "./health";
export * from "./models";
