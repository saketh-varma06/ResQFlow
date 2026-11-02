/**
 * Database setup — connect to MongoDB Atlas and sync all model indexes.
 * Safe to re-run: index sync is idempotent.
 *
 *   npm run db:setup
 */
import "dotenv/config";
import { connectMongo, disconnectMongo } from "../src/db/mongo";

async function main() {
  await connectMongo();
  console.log("MongoDB connected; indexes synced for 10 collections.");
}

main()
  .then(async () => {
    await disconnectMongo();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error((e as Error).message);
    try {
      await disconnectMongo();
    } catch {
      /* connection never opened */
    }
    process.exit(1);
  });
