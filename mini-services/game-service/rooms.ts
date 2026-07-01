// rooms.ts
// In-memory room store + types for the Xiangqi multiplayer game service.
//
// IMPORTANT: All state here is in-process memory. If the service restarts
// (e.g. `bun --hot` reload, crash, deploy), ALL rooms, players and history
// are lost. This is acceptable for the MVP — a future iteration should
// persist to Redis or similar if durability is required.

export type Color = 'red' | 'black'

export interface Player {
  /** socket.id of the player */
  id: string
  /** display name chosen by the player */
  name: string
  /** side the player is playing */
  color: Color
}

export interface MoveCoord {
  row: number
  col: number
}

export interface Move {
  from: MoveCoord
  to: MoveCoord
  /** optional piece code, in case the client includes it */
  piece?: string
}

export interface HistoryEntry {
  move: Move
  by: Color
  timestamp: string // ISO string
}

export interface ChatMessage {
  from: string // display name
  color: Color | 'spectator'
  message: string
  timestamp: string // ISO string
}

export interface Room {
  roomId: string
  password: string
  red?: Player
  black?: Player
  spectators: Player[]
  history: HistoryEntry[]
  chatLog: ChatMessage[]
  /** optional game status: 'waiting' | 'playing' | 'finished' */
  status?: 'waiting' | 'playing' | 'finished'
  createdAt: number
}

/** Public room view (no password, no chat log) safe to send to clients. */
export interface PublicRoom {
  roomId: string
  red?: { id: string; name: string }
  black?: { id: string; name: string }
  spectatorCount: number
  status?: 'waiting' | 'playing' | 'finished'
}

// --- in-memory store ----------------------------------------------------

// Map<roomId, Room>
export const rooms = new Map<string, Room>()

const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no confusing chars
const ROOM_ID_LEN = 6

/** Generate a short, human-friendly room id that is not currently in use. */
export function generateRoomId(length = ROOM_ID_LEN): string {
  let id = ''
  let attempts = 0
  do {
    id = ''
    for (let i = 0; i < length; i++) {
      id += ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)]
    }
    attempts++
    if (attempts > 1000) break // give up avoiding collisions
  } while (rooms.has(id))
  return id
}

/** Strip a Room down to a PublicRoom (no password / chat). */
export function toPublicRoom(room: Room): PublicRoom {
  return {
    roomId: room.roomId,
    red: room.red ? { id: room.red.id, name: room.red.name } : undefined,
    black: room.black ? { id: room.black.id, name: room.black.name } : undefined,
    spectatorCount: room.spectators.length,
    status: room.status,
  }
}

/** True if a given socket is already a player (red or black) in any room. */
export function findRoomByPlayer(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.red?.id === socketId || room.black?.id === socketId) return room
  }
  return undefined
}

/** Find all rooms a socket is in (as player or spectator). */
export function findRoomsBySocket(socketId: string): Room[] {
  const out: Room[] = []
  for (const room of rooms.values()) {
    if (
      room.red?.id === socketId ||
      room.black?.id === socketId ||
      room.spectators.some((s) => s.id === socketId)
    ) {
      out.push(room)
    }
  }
  return out
}

/** Get the color of a socket inside a room, or undefined if not a player. */
export function colorOf(room: Room, socketId: string): Color | undefined {
  if (room.red?.id === socketId) return 'red'
  if (room.black?.id === socketId) return 'black'
  return undefined
}

/** Get the OTHER player's socket id in a room (the opponent). */
export function opponentSocketId(room: Room, socketId: string): string | undefined {
  if (room.red?.id === socketId) return room.black?.id
  if (room.black?.id === socketId) return room.red?.id
  return undefined
}

// --- mutation helpers ---------------------------------------------------

export type CreateResult =
  | { ok: true; room: PublicRoom; color: 'red' }
  | { ok: false; error: string }

export type JoinResult =
  | { ok: true; room: PublicRoom; color: 'black' }
  | { ok: false; error: string }

/** Create a new room. Creator becomes RED. */
export function createRoom(
  roomId: string | undefined,
  password: string,
  displayName: string,
  socketId: string
): CreateResult {
  const finalRoomId = roomId && roomId.trim().length > 0 ? roomId.trim() : generateRoomId()

  if (rooms.has(finalRoomId)) {
    return { ok: false, error: 'Room already exists' }
  }
  // One player cannot be in two rooms as a player at once.
  if (findRoomByPlayer(socketId)) {
    return { ok: false, error: 'You are already in a room' }
  }

  const room: Room = {
    roomId: finalRoomId,
    password,
    red: { id: socketId, name: displayName, color: 'red' },
    black: undefined,
    spectators: [],
    history: [],
    chatLog: [],
    status: 'waiting',
    createdAt: Date.now(),
  }
  rooms.set(finalRoomId, room)
  return { ok: true, room: toPublicRoom(room), color: 'red' }
}

/** Join an existing room as BLACK (second player). */
export function joinRoom(
  roomId: string,
  password: string,
  displayName: string,
  socketId: string
): JoinResult {
  const room = rooms.get(roomId)
  if (!room) return { ok: false, error: 'Room not found' }
  if (room.password !== password) return { ok: false, error: 'Wrong password' }
  if (room.black) return { ok: false, error: 'Room is full' }
  if (room.red?.id === socketId) return { ok: false, error: 'You are already in this room' }
  if (findRoomByPlayer(socketId)) {
    return { ok: false, error: 'You are already in a room' }
  }

  room.black = { id: socketId, name: displayName, color: 'black' }
  room.status = 'playing'
  return { ok: true, room: toPublicRoom(room), color: 'black' }
}

/** Remove a socket from a room (player or spectator). Returns the room if it still exists. */
export function leaveRoom(roomId: string, socketId: string): Room | undefined {
  const room = rooms.get(roomId)
  if (!room) return undefined

  if (room.red?.id === socketId) room.red = undefined
  if (room.black?.id === socketId) room.black = undefined
  room.spectators = room.spectators.filter((s) => s.id !== socketId)

  // Clean up empty rooms.
  if (!room.red && !room.black && room.spectators.length === 0) {
    rooms.delete(roomId)
    return undefined
  }
  // If a player left but spectators remain, mark as waiting again.
  if (!room.red || !room.black) {
    room.status = 'waiting'
  }
  return room
}

/** List all rooms as PublicRoom (no secrets). */
export function listRooms(): PublicRoom[] {
  return Array.from(rooms.values()).map(toPublicRoom)
}

/** Append a move to a room's history. */
export function recordMove(room: Room, move: Move, by: Color): HistoryEntry {
  const entry: HistoryEntry = { move, by, timestamp: new Date().toISOString() }
  room.history.push(entry)
  return entry
}

/** Append a chat message to a room's in-memory recent log (bounded). */
export function recordChat(
  room: Room,
  from: string,
  color: Color | 'spectator',
  message: string
): ChatMessage {
  const msg: ChatMessage = {
    from,
    color,
    message,
    timestamp: new Date().toISOString(),
  }
  room.chatLog.push(msg)
  // keep only the last 100 messages to bound memory
  if (room.chatLog.length > 100) room.chatLog.shift()
  return msg
}
