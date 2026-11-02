import { connectMongo, disconnectMongo } from "../db/mongo";
import { ALL_MODELS } from "../models";

/** Test harness DB plumbing — connect / wipe / disconnect the dedicated test database. */
export async function connectTestDb() {
  await connectMongo();
}

export async function clearDb() {
  await connectMongo();
  // ALL_MODELS is a union of Model<T> types whose deleteMany signatures are
  // mutually incompatible to the checker, so view each model structurally.
  const models = ALL_MODELS as ReadonlyArray<{ deleteMany: (filter: Record<string, never>) => Promise<unknown> }>;
  await Promise.all(models.map((m) => m.deleteMany({})));
}

export async function disconnectDb() {
  await disconnectMongo();
}
