// index.ts — Xiangqi (Cờ Tướng) multiplayer realtime service.
//
// socket.io server on port 3003. The Caddy gateway routes browser
// connections via the `XTransformPort=3003` query param; the server itself
// just listens on 3003 with path "/". The frontend connects with
// `io("/?XTransformPort=3003")`.
//
// The server does NOT validate chess rules — the client engine does that.
// It only relays moves, manages rooms, relays chat and WebRTC signaling.

import { createServer } from 'http'
import { Server } from 'socket.io'
import {
  type Color,
  type Move,
  type Room,
  type Player,
  createRoom,
  joinRoom,
  leaveRoom,
  listRooms,
  findRoomsBySocket,
  colorOf,
  opponentSocketId,
  recordMove,
  recordChat,
  toPublicRoom,
  rooms as roomStore,
} from './rooms'

const PORT = 3003

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy relies on path "/" to route to this port.
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// --- helpers ------------------------------------------------------------

/** Standard Xiangqi starting board. 10 rows x 9 cols.
 *  row 0 = Black back rank (top), row 9 = Red back rank (bottom).
 *  Pieces are encoded as `<color><type>` e.g. 'rK' (red King), 'bC' (black Cannon). */
function buildInitialBoard(): (string | null)[][] {
  const b: (string | null)[][] = Array.from({ length: 10 }, () =>
    Array<string | null>(9).fill(null)
  )
  const backRank = ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R']
  for (let c = 0; c < 9; c++) {
    b[0][c] = 'b' + backRank[c]
    b[9][c] = 'r' + backRank[c]
  }
  // cannons
  b[2][1] = 'bC'
  b[2][7] = 'bC'
  b[7][1] = 'rC'
  b[7][7] = 'rC'
  // pawns (every other col starting at 0)
  for (let c = 0; c < 9; c += 2) {
    b[3][c] = 'bP'
    b[6][c] = 'rP'
  }
  return b
}

interface DisplayNamePayload {
  displayName: string
}
interface RoomIdPayload {
  roomId: string
}

// --- connection lifecycle ----------------------------------------------

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`)

  // ============================================================
  // 1. ROOM MANAGEMENT
  // ============================================================

  // create-room { roomId?, password, displayName } -> creator becomes RED
  socket.on('create-room', (payload: { roomId?: string; password: string; displayName: string }) => {
    try {
      if (!payload || typeof payload.password !== 'string' || typeof payload.displayName !== 'string') {
        socket.emit('create-room-result', { ok: false, error: 'Invalid payload' })
        return
      }
      const result = createRoom(payload.roomId, payload.password, payload.displayName, socket.id)
      if (result.ok) {
        socket.join(result.room.roomId)
        console.log(`[create-room] ${socket.id} created ${result.room.roomId} (red)`)
      } else {
        console.log(`[create-room] ${socket.id} failed: ${result.error}`)
      }
      socket.emit('create-room-result', result)
    } catch (err) {
      console.error(`[create-room] error from ${socket.id}:`, err)
      socket.emit('create-room-result', { ok: false, error: 'Server error' })
    }
  })

  // join-room { roomId, password, displayName } -> second player becomes BLACK
  socket.on('join-room', (payload: { roomId: string; password: string; displayName: string }) => {
    try {
      if (!payload || typeof payload.roomId !== 'string' || typeof payload.password !== 'string' || typeof payload.displayName !== 'string') {
        socket.emit('join-room-result', { ok: false, error: 'Invalid payload' })
        return
      }
      const result = joinRoom(payload.roomId, payload.password, payload.displayName, socket.id)
      if (!result.ok) {
        console.log(`[join-room] ${socket.id} failed (${payload.roomId}): ${result.error}`)
        socket.emit('join-room-result', result)
        return
      }

      const room = roomStore.get(result.room.roomId)
      if (!room || !room.red || !room.black) {
        socket.emit('join-room-result', { ok: false, error: 'Room state invalid' })
        return
      }

      socket.join(room.roomId)

      // Notify BOTH players that the game is starting.
      const startPayload = {
        roomId: room.roomId,
        red: { id: room.red.id, name: room.red.name },
        black: { id: room.black.id, name: room.black.name },
        initialBoard: buildInitialBoard(),
      }
      io.to(room.roomId).emit('game-start', startPayload)
      console.log(`[join-room] ${socket.id} joined ${room.roomId} (black); game-start emitted`)

      socket.emit('join-room-result', { ok: true, color: 'black' })
    } catch (err) {
      console.error(`[join-room] error from ${socket.id}:`, err)
      socket.emit('join-room-result', { ok: false, error: 'Server error' })
    }
  })

  // leave-room { roomId } -> notify opponent via 'opponent-left'
  socket.on('leave-room', (payload: RoomIdPayload) => {
    try {
      const roomId = payload?.roomId
      if (!roomId) {
        socket.emit('error', { event: 'leave-room', error: 'Missing roomId' })
        return
      }
      console.log(`[leave-room] ${socket.id} leaving ${roomId}`)
      // Notify remaining players before removal.
      socket.to(roomId).emit('opponent-left', { roomId, by: socket.id })
      leaveRoom(roomId, socket.id)
      socket.leave(roomId)
    } catch (err) {
      console.error(`[leave-room] error from ${socket.id}:`, err)
    }
  })

  // list-rooms -> return public room list (no passwords)
  socket.on('list-rooms', () => {
    try {
      socket.emit('rooms-list', { rooms: listRooms() })
    } catch (err) {
      console.error(`[list-rooms] error from ${socket.id}:`, err)
      socket.emit('rooms-list', { rooms: [] })
    }
  })

  // ============================================================
  // 2. GAME MOVES
  // ============================================================

  // make-move { roomId, move } -> relay to opponent as 'opponent-move'.
  // Server does NOT validate rules.
  socket.on('make-move', (payload: { roomId: string; move: Move }) => {
    try {
      const roomId = payload?.roomId
      const move = payload?.move
      if (!roomId || !move || !move.from || !move.to) {
        socket.emit('error', { event: 'make-move', error: 'Invalid payload' })
        return
      }
      const room = roomStore.get(roomId)
      if (!room) {
        socket.emit('error', { event: 'make-move', error: 'Room not found' })
        return
      }
      const color = colorOf(room, socket.id)
      if (!color) {
        socket.emit('error', { event: 'make-move', error: 'You are not a player in this room' })
        return
      }

      recordMove(room, move, color)
      const timestamp = new Date().toISOString()
      // Relay to opponent (everyone in the socket.io room except sender).
      socket.to(roomId).emit('opponent-move', { move, by: color, timestamp })
      console.log(`[make-move] ${roomId} ${color}: ${move.from.row},${move.from.col} -> ${move.to.row},${move.to.col}`)
    } catch (err) {
      console.error(`[make-move] error from ${socket.id}:`, err)
    }
  })

  // resign { roomId } -> emit 'game-over' { reason: 'resign', winner: opponentColor }
  socket.on('resign', (payload: RoomIdPayload) => {
    try {
      const roomId = payload?.roomId
      const room = roomId ? roomStore.get(roomId) : undefined
      if (!room) {
        socket.emit('error', { event: 'resign', error: 'Room not found' })
        return
      }
      const color = colorOf(room, socket.id)
      if (!color) {
        socket.emit('error', { event: 'resign', error: 'You are not a player in this room' })
        return
      }
      const winner: Color = color === 'red' ? 'black' : 'red'
      room.status = 'finished'
      io.to(roomId).emit('game-over', { reason: 'resign', winner })
      console.log(`[resign] ${roomId} ${color} resigned; winner=${winner}`)
    } catch (err) {
      console.error(`[resign] error from ${socket.id}:`, err)
    }
  })

  // offer-draw { roomId } -> emit 'draw-offered' to opponent
  socket.on('offer-draw', (payload: RoomIdPayload) => {
    try {
      const roomId = payload?.roomId
      const room = roomId ? roomStore.get(roomId) : undefined
      if (!room) {
        socket.emit('error', { event: 'offer-draw', error: 'Room not found' })
        return
      }
      const color = colorOf(room, socket.id)
      if (!color) {
        socket.emit('error', { event: 'offer-draw', error: 'You are not a player in this room' })
        return
      }
      socket.to(roomId).emit('draw-offered', { from: color })
      console.log(`[offer-draw] ${roomId} ${color}`)
    } catch (err) {
      console.error(`[offer-draw] error from ${socket.id}:`, err)
    }
  })

  // accept-draw { roomId } -> emit 'game-over' { reason: 'draw' } to room
  socket.on('accept-draw', (payload: RoomIdPayload) => {
    try {
      const roomId = payload?.roomId
      const room = roomId ? roomStore.get(roomId) : undefined
      if (!room) {
        socket.emit('error', { event: 'accept-draw', error: 'Room not found' })
        return
      }
      const color = colorOf(room, socket.id)
      if (!color) {
        socket.emit('error', { event: 'accept-draw', error: 'You are not a player in this room' })
        return
      }
      room.status = 'finished'
      io.to(roomId).emit('game-over', { reason: 'draw' })
      console.log(`[accept-draw] ${roomId} draw accepted`)
    } catch (err) {
      console.error(`[accept-draw] error from ${socket.id}:`, err)
    }
  })

  // decline-draw { roomId } -> emit 'draw-declined' to opponent (offerer)
  socket.on('decline-draw', (payload: RoomIdPayload) => {
    try {
      const roomId = payload?.roomId
      const room = roomId ? roomStore.get(roomId) : undefined
      if (!room) {
        socket.emit('error', { event: 'decline-draw', error: 'Room not found' })
        return
      }
      const color = colorOf(room, socket.id)
      if (!color) {
        socket.emit('error', { event: 'decline-draw', error: 'You are not a player in this room' })
        return
      }
      socket.to(roomId).emit('draw-declined', { from: color })
      console.log(`[decline-draw] ${roomId} ${color} declined`)
    } catch (err) {
      console.error(`[decline-draw] error from ${socket.id}:`, err)
    }
  })

  // ============================================================
  // 3. CHAT
  // ============================================================

  // chat-message { roomId, message } -> emit 'chat-message' to everyone in room
  socket.on('chat-message', (payload: { roomId: string; message: string }) => {
    try {
      const roomId = payload?.roomId
      const message = payload?.message
      if (!roomId || typeof message !== 'string' || message.trim().length === 0) {
        socket.emit('error', { event: 'chat-message', error: 'Invalid payload' })
        return
      }
      const room = roomStore.get(roomId)
      if (!room) {
        socket.emit('error', { event: 'chat-message', error: 'Room not found' })
        return
      }
      const color = colorOf(room, socket.id) ?? 'spectator'
      const displayName =
        room.red?.id === socket.id ? room.red.name :
        room.black?.id === socket.id ? room.black.name :
        room.spectators.find((s) => s.id === socket.id)?.name ?? 'Unknown'
      const entry = recordChat(room, displayName, color, message)
      io.to(roomId).emit('chat-message', {
        roomId,
        from: entry.from,
        color: entry.color,
        message: entry.message,
        timestamp: entry.timestamp,
      })
    } catch (err) {
      console.error(`[chat-message] error from ${socket.id}:`, err)
    }
  })

  // ============================================================
  // 4. WEBRTC SIGNALING (voice chat) — relay only
  // ============================================================

  // voice-request { roomId } -> ask opponent 'voice-request' { from: color }
  socket.on('voice-request', (payload: RoomIdPayload) => {
    try {
      const roomId = payload?.roomId
      const room = roomId ? roomStore.get(roomId) : undefined
      if (!room) return
      const color = colorOf(room, socket.id)
      if (!color) return
      socket.to(roomId).emit('voice-request', { from: color })
      console.log(`[voice-request] ${roomId} ${color}`)
    } catch (err) {
      console.error(`[voice-request] error from ${socket.id}:`, err)
    }
  })

  // voice-offer { roomId, sdp } -> forward as 'voice-offer' { from: color, sdp }
  socket.on('voice-offer', (payload: { roomId: string; sdp: unknown }) => {
    try {
      const roomId = payload?.roomId
      const room = roomId ? roomStore.get(roomId) : undefined
      if (!room) return
      const color = colorOf(room, socket.id)
      if (!color) return
      socket.to(roomId).emit('voice-offer', { from: color, sdp: payload.sdp })
    } catch (err) {
      console.error(`[voice-offer] error from ${socket.id}:`, err)
    }
  })

  // voice-answer { roomId, sdp } -> forward as 'voice-answer' { from: color, sdp }
  socket.on('voice-answer', (payload: { roomId: string; sdp: unknown }) => {
    try {
      const roomId = payload?.roomId
      const room = roomId ? roomStore.get(roomId) : undefined
      if (!room) return
      const color = colorOf(room, socket.id)
      if (!color) return
      socket.to(roomId).emit('voice-answer', { from: color, sdp: payload.sdp })
    } catch (err) {
      console.error(`[voice-answer] error from ${socket.id}:`, err)
    }
  })

  // voice-ice { roomId, candidate } -> forward as 'voice-ice' { from: color, candidate }
  socket.on('voice-ice', (payload: { roomId: string; candidate: unknown }) => {
    try {
      const roomId = payload?.roomId
      const room = roomId ? roomStore.get(roomId) : undefined
      if (!room) return
      const color = colorOf(room, socket.id)
      if (!color) return
      socket.to(roomId).emit('voice-ice', { from: color, candidate: payload.candidate })
    } catch (err) {
      console.error(`[voice-ice] error from ${socket.id}:`, err)
    }
  })

  // voice-end { roomId } -> notify opponent 'voice-ended'
  socket.on('voice-end', (payload: RoomIdPayload) => {
    try {
      const roomId = payload?.roomId
      const room = roomId ? roomStore.get(roomId) : undefined
      if (!room) return
      const color = colorOf(room, socket.id)
      if (!color) return
      socket.to(roomId).emit('voice-ended', { from: color })
      console.log(`[voice-end] ${roomId} ${color}`)
    } catch (err) {
      console.error(`[voice-end] error from ${socket.id}:`, err)
    }
  })

  // ============================================================
  // 5. DISCONNECT / ERROR
  // ============================================================

  socket.on('disconnect', () => {
    try {
      const touched = findRoomsBySocket(socket.id)
      for (const room of touched) {
        const wasPlayer = colorOf(room, socket.id) !== undefined
        // Notify remaining players in that room.
        socket.to(room.roomId).emit('opponent-left', { roomId: room.roomId, by: socket.id })
        const remaining = leaveRoom(room.roomId, socket.id)
        if (wasPlayer) {
          console.log(`[disconnect] ${socket.id} left room ${room.roomId}`)
        }
        void remaining // room may now be deleted
      }
      console.log(`[disconnect] ${socket.id} (rooms cleaned: ${touched.length})`)
    } catch (err) {
      console.error(`[disconnect] error from ${socket.id}:`, err)
    }
  })

  socket.on('error', (err: unknown) => {
    console.error(`[socket-error] ${socket.id}:`, err)
  })
})

// --- start --------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`[game-service] WebSocket server listening on port ${PORT} (path "/")`)
})

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[game-service] ${signal} received, shutting down...`)
  io.close(() => {
    httpServer.close(() => {
      console.log('[game-service] closed')
      process.exit(0)
    })
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Re-export some types/values so consumers importing from the entrypoint can use them.
export { roomStore, toPublicRoom, type Room, type Player, type Color, type Move }
