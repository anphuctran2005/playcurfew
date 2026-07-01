/**
 * Xiangqi game socket.io server — consolidated so it can run inside the
 * Next.js process (via instrumentation.ts) AND as a standalone mini-service.
 *
 * Why in-process: background processes started from the dev shell do not
 * survive between commands in this sandbox, but the Next.js dev server
 * (started by the scaffold) does. Running the socket.io server here keeps
 * it alive for the whole session. It still listens on its OWN port (3003)
 * and is still reached through the Caddy gateway via `XTransformPort=3003`,
 * exactly as the frontend expects.
 *
 * Singleton guard prevents double-bind during Next.js hot reloads.
 */
import { createServer, type Server as HttpServer } from 'http';
import { Server } from 'socket.io';

// ---- types (mirror mini-services/game-service/rooms.ts) ----------------
type Color = 'red' | 'black';
interface Player { id: string; name: string; color: Color }
interface MoveCoord { row: number; col: number }
interface Move { from: MoveCoord; to: MoveCoord; piece?: string }
interface Room {
  roomId: string;
  password: string;
  red?: Player;
  black?: Player;
  spectators: Player[];
  history: { move: Move; by: Color; timestamp: string }[];
  chatLog: { from: string; color: Color | 'spectator'; message: string; timestamp: string }[];
  status?: 'waiting' | 'playing' | 'finished';
  createdAt: number;
}
interface PublicRoom {
  roomId: string;
  red?: { id: string; name: string };
  black?: { id: string; name: string };
  spectatorCount: number;
  status?: 'waiting' | 'playing' | 'finished';
}

// ---- in-memory store ----------------------------------------------------
const rooms = new Map<string, Room>();
const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LEN = 6;

function generateRoomId(): string {
  let id = '';
  for (let i = 0; i < ROOM_ID_LEN; i++) {
    id += ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)];
  }
  return rooms.has(id) ? generateRoomId() : id;
}

function toPublicRoom(room: Room): PublicRoom {
  return {
    roomId: room.roomId,
    red: room.red ? { id: room.red.id, name: room.red.name } : undefined,
    black: room.black ? { id: room.black.id, name: room.black.name } : undefined,
    spectatorCount: room.spectators.length,
    status: room.status,
  };
}

function findRoomByPlayer(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.red?.id === socketId || room.black?.id === socketId) return room;
  }
  return undefined;
}

function findRoomsBySocket(socketId: string): Room[] {
  const out: Room[] = [];
  for (const room of rooms.values()) {
    if (
      room.red?.id === socketId ||
      room.black?.id === socketId ||
      room.spectators.some((s) => s.id === socketId)
    ) {
      out.push(room);
    }
  }
  return out;
}

function colorOf(room: Room, socketId: string): Color | undefined {
  if (room.red?.id === socketId) return 'red';
  if (room.black?.id === socketId) return 'black';
  return undefined;
}

function createRoom(roomId: string | undefined, password: string, displayName: string, socketId: string) {
  const finalRoomId = roomId && roomId.trim().length > 0 ? roomId.trim() : generateRoomId();
  if (rooms.has(finalRoomId)) return { ok: false as const, error: 'Room already exists' };
  if (findRoomByPlayer(socketId)) return { ok: false as const, error: 'You are already in a room' };
  const room: Room = {
    roomId: finalRoomId, password,
    red: { id: socketId, name: displayName, color: 'red' },
    black: undefined, spectators: [], history: [], chatLog: [],
    status: 'waiting', createdAt: Date.now(),
  };
  rooms.set(finalRoomId, room);
  return { ok: true as const, room: toPublicRoom(room), color: 'red' as Color };
}

function joinRoom(roomId: string, password: string, displayName: string, socketId: string) {
  const room = rooms.get(roomId);
  if (!room) return { ok: false as const, error: 'Room not found' };
  if (room.password !== password) return { ok: false as const, error: 'Wrong password' };
  if (room.black) return { ok: false as const, error: 'Room is full' };
  if (room.red?.id === socketId) return { ok: false as const, error: 'You are already in this room' };
  if (findRoomByPlayer(socketId)) return { ok: false as const, error: 'You are already in a room' };
  room.black = { id: socketId, name: displayName, color: 'black' };
  room.status = 'playing';
  return { ok: true as const, room: toPublicRoom(room), color: 'black' as Color };
}

function leaveRoom(roomId: string, socketId: string): Room | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  if (room.red?.id === socketId) room.red = undefined;
  if (room.black?.id === socketId) room.black = undefined;
  room.spectators = room.spectators.filter((s) => s.id !== socketId);
  if (!room.red && !room.black && room.spectators.length === 0) {
    rooms.delete(roomId);
    return undefined;
  }
  if (!room.red || !room.black) room.status = 'waiting';
  return room;
}

function listRooms(): PublicRoom[] {
  return Array.from(rooms.values()).map(toPublicRoom);
}

function buildInitialBoard(): (string | null)[][] {
  const b: (string | null)[][] = Array.from({ length: 10 }, () => Array<string | null>(9).fill(null));
  const backRank = ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R'];
  for (let c = 0; c < 9; c++) {
    b[0][c] = 'b' + backRank[c];
    b[9][c] = 'r' + backRank[c];
  }
  b[2][1] = 'bC'; b[2][7] = 'bC';
  b[7][1] = 'rC'; b[7][7] = 'rC';
  for (let c = 0; c < 9; c += 2) { b[3][c] = 'bP'; b[6][c] = 'rP'; }
  return b;
}

// ---- singleton server starter ------------------------------------------
const GLOBAL_KEY = '__xiangqi_game_service__';

interface StartedState { io: Server; httpServer: HttpServer; port: number }

function getGlobal(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

/**
 * Start the socket.io game server on the given port. Safe to call multiple
 * times (e.g. across hot reloads): returns the existing instance if bound.
 */
export function startGameService(port = 3003): StartedState {
  const g = getGlobal();
  const existing = g[GLOBAL_KEY] as StartedState | undefined;
  if (existing) {
    return existing;
  }

  const httpServer = createServer();
  const io = new Server(httpServer, {
    path: '/',
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    console.log(`[game-service] connect ${socket.id}`);

    // ---- room management ----
    socket.on('create-room', (payload: { roomId?: string; password: string; displayName: string }) => {
      try {
        if (!payload || typeof payload.password !== 'string' || typeof payload.displayName !== 'string') {
          socket.emit('create-room-result', { ok: false, error: 'Invalid payload' });
          return;
        }
        const result = createRoom(payload.roomId, payload.password, payload.displayName, socket.id);
        if (result.ok) {
          socket.join(result.room.roomId);
          console.log(`[game-service] create-room ${socket.id} -> ${result.room.roomId} (red)`);
        }
        socket.emit('create-room-result', result);
      } catch (err) {
        console.error('[game-service] create-room error', err);
        socket.emit('create-room-result', { ok: false, error: 'Server error' });
      }
    });

    socket.on('join-room', (payload: { roomId: string; password: string; displayName: string }) => {
      try {
        if (!payload || typeof payload.roomId !== 'string' || typeof payload.password !== 'string' || typeof payload.displayName !== 'string') {
          socket.emit('join-room-result', { ok: false, error: 'Invalid payload' });
          return;
        }
        const result = joinRoom(payload.roomId, payload.password, payload.displayName, socket.id);
        if (!result.ok) {
          socket.emit('join-room-result', result);
          return;
        }
        const room = rooms.get(result.room.roomId);
        if (!room || !room.red || !room.black) {
          socket.emit('join-room-result', { ok: false, error: 'Room state invalid' });
          return;
        }
        socket.join(room.roomId);
        io.to(room.roomId).emit('game-start', {
          roomId: room.roomId,
          red: { id: room.red.id, name: room.red.name },
          black: { id: room.black.id, name: room.black.name },
          initialBoard: buildInitialBoard(),
        });
        socket.emit('join-room-result', { ok: true, color: 'black' });
        console.log(`[game-service] join-room ${socket.id} -> ${room.roomId} (black)`);
      } catch (err) {
        console.error('[game-service] join-room error', err);
        socket.emit('join-room-result', { ok: false, error: 'Server error' });
      }
    });

    socket.on('leave-room', (payload: { roomId: string }) => {
      try {
        const roomId = payload?.roomId;
        if (!roomId) return;
        socket.to(roomId).emit('opponent-left', { roomId, by: socket.id });
        leaveRoom(roomId, socket.id);
        socket.leave(roomId);
      } catch (err) {
        console.error('[game-service] leave-room error', err);
      }
    });

    socket.on('list-rooms', () => {
      try {
        socket.emit('rooms-list', { rooms: listRooms() });
      } catch {
        socket.emit('rooms-list', { rooms: [] });
      }
    });

    // ---- moves ----
    socket.on('make-move', (payload: { roomId: string; move: Move }) => {
      try {
        const roomId = payload?.roomId;
        const move = payload?.move;
        if (!roomId || !move || !move.from || !move.to) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const color = colorOf(room, socket.id);
        if (!color) return;
        room.history.push({ move, by: color, timestamp: new Date().toISOString() });
        socket.to(roomId).emit('opponent-move', { move, by: color, timestamp: new Date().toISOString() });
      } catch (err) {
        console.error('[game-service] make-move error', err);
      }
    });

    socket.on('resign', (payload: { roomId: string }) => {
      try {
        const room = payload?.roomId ? rooms.get(payload.roomId) : undefined;
        if (!room) return;
        const color = colorOf(room, socket.id);
        if (!color) return;
        const winner: Color = color === 'red' ? 'black' : 'red';
        room.status = 'finished';
        io.to(room.roomId).emit('game-over', { reason: 'resign', winner });
      } catch (err) {
        console.error('[game-service] resign error', err);
      }
    });

    socket.on('offer-draw', (payload: { roomId: string }) => {
      const room = payload?.roomId ? rooms.get(payload.roomId) : undefined;
      if (!room) return;
      const color = colorOf(room, socket.id);
      if (!color) return;
      socket.to(room.roomId).emit('draw-offered', { from: color });
    });

    socket.on('accept-draw', (payload: { roomId: string }) => {
      const room = payload?.roomId ? rooms.get(payload.roomId) : undefined;
      if (!room) return;
      const color = colorOf(room, socket.id);
      if (!color) return;
      room.status = 'finished';
      io.to(room.roomId).emit('game-over', { reason: 'draw' });
    });

    socket.on('decline-draw', (payload: { roomId: string }) => {
      const room = payload?.roomId ? rooms.get(payload.roomId) : undefined;
      if (!room) return;
      const color = colorOf(room, socket.id);
      if (!color) return;
      socket.to(room.roomId).emit('draw-declined', { from: color });
    });

    // ---- chat ----
    socket.on('chat-message', (payload: { roomId: string; message: string }) => {
      try {
        const roomId = payload?.roomId;
        const message = payload?.message;
        if (!roomId || typeof message !== 'string' || message.trim().length === 0) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const color = colorOf(room, socket.id) ?? 'spectator';
        const displayName =
          room.red?.id === socket.id ? room.red.name :
          room.black?.id === socket.id ? room.black.name : 'Unknown';
        const entry = { from: displayName, color, message, timestamp: new Date().toISOString() };
        room.chatLog.push(entry);
        if (room.chatLog.length > 100) room.chatLog.shift();
        io.to(roomId).emit('chat-message', { roomId, ...entry });
      } catch (err) {
        console.error('[game-service] chat error', err);
      }
    });

    // ---- WebRTC signaling relay ----
    const relay = (event: string) => (payload: { roomId: string; sdp?: unknown; candidate?: unknown }) => {
      const room = payload?.roomId ? rooms.get(payload.roomId) : undefined;
      if (!room) return;
      const color = colorOf(room, socket.id);
      if (!color) return;
      const fwd: Record<string, unknown> = { from: color };
      if (payload.sdp !== undefined) fwd.sdp = payload.sdp;
      if (payload.candidate !== undefined) fwd.candidate = payload.candidate;
      socket.to(payload.roomId).emit(event, fwd);
    };
    socket.on('voice-request', (p: { roomId: string }) => {
      const room = p?.roomId ? rooms.get(p.roomId) : undefined;
      if (!room) return;
      const color = colorOf(room, socket.id);
      if (color) socket.to(p.roomId).emit('voice-request', { from: color });
    });
    socket.on('voice-offer', relay('voice-offer'));
    socket.on('voice-answer', relay('voice-answer'));
    socket.on('voice-ice', relay('voice-ice'));
    socket.on('voice-end', (p: { roomId: string }) => {
      const room = p?.roomId ? rooms.get(p.roomId) : undefined;
      if (!room) return;
      const color = colorOf(room, socket.id);
      if (color) socket.to(p.roomId).emit('voice-ended', { from: color });
    });

    // ---- disconnect ----
    socket.on('disconnect', () => {
      try {
        const touched = findRoomsBySocket(socket.id);
        for (const room of touched) {
          socket.to(room.roomId).emit('opponent-left', { roomId: room.roomId, by: socket.id });
          leaveRoom(room.roomId, socket.id);
        }
      } catch (err) {
        console.error('[game-service] disconnect error', err);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`[game-service] socket.io server listening on port ${port} (path "/")`);
  });

  const state: StartedState = { io, httpServer, port };
  g[GLOBAL_KEY] = state;
  return state;
}
