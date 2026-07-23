"use client";

import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

/**
 * Returns a singleton, typed Socket.IO client.
 *
 * TODO(you):
 *  - Point NEXT_PUBLIC_SOCKET_URL at your deployed server (.env.local for dev).
 *  - If your server requires auth, pass a token here, e.g.:
 *      io(url, { auth: { token: getSessionToken() } })
 *    and verify it server-side in your `io.use((socket, next) => ...)` middleware.
 *  - Consider reconnection options (reconnectionAttempts, reconnectionDelay)
 *    once you build out the "player disconnected mid-race" handling.
 */
export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: false,
    });
  }
  return socket;
}