import type { Server } from "socket.io";
// Registry so services can emit real-time events without circular imports.
let io: Server | null = null;
export function setIO(server: Server) { io = server; }
export function getIO() { return io; }
export function emitToUser(userId: string, event: string, payload: unknown) { io?.to(`user:${userId}`).emit(event, payload); }
export function emitToRole(role: string, event: string, payload: unknown) { io?.to(`role:${role}`).emit(event, payload); }
export function emitToAll(event: string, payload: unknown) { io?.emit(event, payload); }
