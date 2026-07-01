/**
 * Socket.io client singleton for the Xiangqi multiplayer service.
 * Connects via the Caddy gateway using XTransformPort=3003 (path "/").
 */
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Get (or lazily create) the shared socket connection to the game service. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
  }
  return socket;
}

/** Fully disconnect and clear the singleton (used on "leave game"). */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
