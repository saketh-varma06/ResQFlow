import "dotenv/config";
import { createServer } from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { initSocket } from "./socket";
const httpServer = createServer(app);
initSocket(httpServer);
httpServer.listen(env.PORT, () => {
  console.log(`ResQFlow backend listening on http://localhost:${env.PORT} — health: /api/health · docs: /api/docs`);
});
