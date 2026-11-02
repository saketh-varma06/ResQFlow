import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { env } from "../config/env";
import { UserModel } from "../models";
import { verifyToken } from "../utils/security";
import { parseCookies } from "../utils/session";
import { setIO } from "../utils/realtime";

/**
 * Authenticated Socket.IO — connections without a valid session are rejected.
 * Token sources (first match wins): handshake auth token (API clients/tests),
 * the `resqflow_session` httpOnly cookie (browser app), or a `token` query param.
 * The token's `tv` claim must match the user's current tokenVersion, so logout /
 * password change also disconnects realtime access on the next connect.
 * Rooms: user:<id> (personal notifications), role:<ROLE> (role event feeds).
 * Event visibility: sos:* and incident:* go to RESPONDER/ADMIN rooms and the
 * record's owner; alert:* and shelter:* are broadcast to authenticated users
 * (the same data every role can read through the REST API).
 */
export function initSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, { cors: { origin: env.CORS_ORIGIN, credentials: true } });

  io.use(async (socket: Socket, next) => {
    try {
      const fromAuth = socket.handshake.auth?.token as string | undefined;
      const fromQuery = socket.handshake.query?.token as string | undefined;
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = fromAuth ?? cookies["resqflow_session"] ?? fromQuery;
      if (!token) return next(new Error("Authentication required"));
      const payload = verifyToken(token);
      const user = await UserModel.findById(payload.sub).select({ role: 1, status: 1, tokenVersion: 1 });
      if (!user) return next(new Error("Authentication required"));
      if (payload.tv !== user.tokenVersion) return next(new Error("Session has been invalidated"));
      if (user.status !== "ACTIVE") return next(new Error("Account is not active"));
      socket.data.user = { id: user.id, role: user.role };
      next();
    } catch {
      next(new Error("Authentication required"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as { id: string; role: string };
    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);
    socket.emit("connected", { status: "ok", service: "resqflow-backend", authenticated: true, userId: user.id, role: user.role });
  });
  setIO(io);
  return io;
}
