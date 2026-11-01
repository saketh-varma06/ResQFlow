import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
/**
 * Authenticated realtime connection. The browser sends the httpOnly session
 * cookie automatically (withCredentials); the server validates it (including
 * tokenVersion) before joining the socket to user/role rooms.
 */
export function getSocket(): Socket {
  if (!socket) {
    // Default: same origin as the page — the Vite dev/preview servers proxy
    // /socket.io (websocket) to the backend, so this works locally and through
    // any single-origin hosting/tunnel. VITE_API_URL overrides it when set.
    const base = (import.meta.env.VITE_API_URL as string | undefined) || "";
    socket = io(base, { withCredentials: true, transports: ["websocket", "polling"], reconnectionAttempts: 10, reconnectionDelay: 1500 });
  }
  return socket;
}
export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
