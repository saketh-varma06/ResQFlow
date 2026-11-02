import "dotenv/config";
import { createServer } from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { connectMongo } from "./db/mongo";
import { initSocket } from "./socket";
const httpServer = createServer(app);
initSocket(httpServer);
connectMongo()
  .then(() => {
    httpServer.listen(env.PORT, () => {
      console.log(`ResQFlow backend listening on http://localhost:${env.PORT} — health: /api/health · docs: /api/docs`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB Atlas:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
