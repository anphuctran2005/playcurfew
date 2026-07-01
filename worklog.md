# Worklog - Xiangqi (Cờ Tướng) Game Project

## Project Overview
Build a Chinese Chess (Xiangqi / Cờ Tướng) game with:
- Rules from `upload/Luat-Co-Tuong.md` (9x10 board, river, palace, 7 piece types)
- Multiple modes: vs Bot (difficulty levels), Multiplayer (room ID + password)
- Text chat (LLM-powered bot replies in bot mode)
- Voice chat (WebRTC peer-to-peer in multiplayer; ASR + TTS in bot mode)

## Tech Stack
- Next.js 16 App Router + TypeScript + Tailwind 4 + shadcn/ui
- Game engine: pure TS in `src/lib/xiangqi/`
- Realtime: socket.io mini-service at `mini-services/game-service/` (port 3003)
- AI skills (LLM/ASR/TTS) via z-ai-web-dev-sdk in API routes

## Architecture
- Board: 9 cols (0-8) x 10 rows (0-9). Row 0 = Black back rank (top), Row 9 = Red back rank (bottom). River between row 4 and 5.
- Red moves first. Red palace: cols 3-5, rows 7-9. Black palace: cols 3-5, rows 0-2.
- Piece codes: K=King/Tướng, A=Advisor/Sĩ, B=Bishop/Tượng, N=Knight/Mã, R=Rook/Xe, C=Cannon/Pháo, P=Pawn/Tốt.

## Task Plan
- Task 1: Game engine (`src/lib/xiangqi/`) - subagent
- Task 2: WebSocket game service (`mini-services/game-service/`) - subagent (parallel with 1)
- Task 3: Frontend UI (home, board, bot screen, mp screen, chat, voice) - main agent
- Task 4: API routes for AI chat / ASR / TTS - main agent
- Task 5: Integration, dev server, lint, agent-browser verification - main agent

---
Task ID: 0
Agent: main (orchestrator)
Task: Initialize project plan and worklog

Work Log:
- Read rules file Luat-Co-Tuong.md
- Explored project structure (Next.js 16, shadcn/ui, prisma sqlite)
- Reviewed websocket example (socket.io path "/", XTransformPort query)
- Installed socket.io and socket.io-client
- Created this worklog with full plan

Stage Summary:
- Ready to launch parallel subagents for game engine (Task 1) and websocket service (Task 2)
- Engine API contract defined (see Task 1 prompt)
- WS event protocol defined (see Task 2 prompt)

---
Task ID: 2
Agent: game-service subagent
Task: Build a Bun + socket.io realtime backend (port 3003) for the Xiangqi multiplayer game: room management (create/join/leave with password), move relay, draw/resign, chat, and WebRTC voice signaling relay.

Work Log:
- Read worklog.md and examples/websocket/server.ts to confirm the socket.io pattern (path "/", cors "*", XTransformPort routing).
- Created /home/z/my-project/mini-services/game-service/ with package.json (socket.io dep + bun-types), tsconfig.json (ESNext, types ["bun-types"]), bun.lock.
- Wrote rooms.ts: in-memory room store + types (Color, Player, Move, HistoryEntry, ChatMessage, Room, PublicRoom) + helpers (generateRoomId, createRoom, joinRoom, leaveRoom, listRooms, colorOf, opponentSocketId, recordMove, recordChat, toPublicRoom, findRoomsBySocket). Noted in a comment that all state is lost on restart (acceptable for MVP).
- Wrote index.ts: socket.io server on port 3003, path "/", cors "*". Handlers: create-room, join-room (emits game-start to both players with {roomId, red:{id,name}, black:{id,name}, initialBoard}), leave-room (emits opponent-left), list-rooms, make-move (relays opponent-move, stores history), resign, offer-draw, accept-draw, decline-draw, chat-message (broadcast to room), voice-request/voice-offer/voice-answer/voice-ice/voice-end (relay to opponent), disconnect cleanup. Every handler is wrapped in try/catch and validates inputs so bad payloads never crash the server. Server does NOT validate chess rules (client engine owns that).
- Built buildInitialBoard() returning a 10x9 array of '<color><type>' piece codes (e.g. 'rK','bC') for the standard Xiangqi starting position, sent to both clients on game-start.
- Ran `bun install` (socket.io 4.8.3 + bun-types 1.3.14 installed).
- Wrote a temporary smoke test that spawned the server and connected two socket.io-client clients: verified create-room -> join-room -> game-start (both clients, with 10-row initialBoard), chat-message broadcast, opponent-move relay, voice-request relay, resign -> game-over {reason:'resign', winner:'black'}, bad-input safety (no crash), leave-room -> opponent-left. All passed; then removed the smoke test and the socket.io-client dev dep.
- Killed a lingering test process holding port 3003 and confirmed `timeout 4 bun index.ts` prints "[game-service] WebSocket server listening on port 3003 (path "/")" then shuts down cleanly (exit 124 from timeout, as expected).

Stage Summary:
- Files produced:
  - mini-services/game-service/package.json (name "game-service", scripts dev/start, dep socket.io, devDep bun-types)
  - mini-services/game-service/tsconfig.json (ESNext, types ["bun-types"])
  - mini-services/game-service/rooms.ts (types Player/Room + in-memory store + helpers)
  - mini-services/game-service/index.ts (socket.io server on port 3003, path "/")
  - mini-services/game-service/bun.lock (after bun install)
- Client -> server events: create-room, join-room, leave-room, list-rooms, make-move, resign, offer-draw, accept-draw, decline-draw, chat-message, voice-request, voice-offer, voice-answer, voice-ice, voice-end.
- Server -> client events: create-room-result, join-room-result, game-start, opponent-move, game-over, draw-offered, draw-declined, opponent-left, chat-message, voice-request, voice-offer, voice-answer, voice-ice, voice-ended, rooms-list, error.
- Server starts cleanly on port 3003; all main flows verified via smoke test.
- Constraint notes: no chess-rule validation on the server; port 3003 only appears in the listen() call and logs (no hardcoded port in any URL); state is in-memory only (documented in rooms.ts).

---
Task ID: 1
Agent: xiangqi-engine-builder
Task: Build a complete, well-typed Xiangqi game engine as pure TypeScript in `src/lib/xiangqi/`.

Work Log:
- Read `/home/z/my-project/worklog.md` and `/home/z/my-project/upload/Luat-Co-Tuong.md` for project plan and rules.
- Created `src/lib/xiangqi/types.ts` - Color, PieceType, Piece, Position, Move, GameStatus, Board, DifficultyLevel, GameState.
- Created `src/lib/xiangqi/constants.ts` - board dims, palace bounds, river rows, Vietnamese piece names, piece values (K=10000, R=900, C=450, N=400, B=200, A=200, P=100), piece-square tables (per type, from Red's perspective), `createInitialBoard()`, `INITIAL_BOARD` alias, `cloneBoard`.
- Created `src/lib/xiangqi/moves.ts` - `inBoard`, `inPalace`, `isAcrossRiver`, `isOnColorSide`, `findKing`, `generalsFacing`, `getPseudoLegalMoves` (handles King/Advisor/Bishop eye/Knight leg/Rook slide/Cannon screen-exactly-1/Pawn forward+sideways-after-river), `isKingAttacked`.
- Created `src/lib/xiangqi/validator.ts` - `applyMoveToBoard`, `isMoveLegal`, `getLegalMoves`, `getAllLegalMoves`, `isInCheck`, `isCheckmate`, `isStalemate`, `hasAnyLegalMove`, re-exports `findKing`/`generalsFacing`.
- Created `src/lib/xiangqi/engine.ts` - pure functions (`createGame`, `applyMove`, `undo`, `getLegalMovesFrom`, `getAllLegalMovesFrom`, `getStatus`) plus a `GameEngine` class wrapper. State holds board/turn/history/status/captured plus private undo stacks (board snapshots, turns, statuses, captured-list lengths). Status recomputed after each move (no-legal-move => mover wins, covering both checkmate and the no-legal-move-loses rule).
- Created `src/lib/xiangqi/ai.ts` - `evaluate` (material + PST + mobility + king-safety check), `chooseMove(state, level, maxTimeMs=1500)`. Levels: easy=random legal; medium=greedy 1-ply with tie-break randomness; hard=minimax+alpha-beta depth 2; expert=minimax+alpha-beta depth 3 with capture-first move ordering and time guard returning best-so-far. All AI functions are synchronous / pure.
- Created `src/lib/xiangqi/index.ts` - barrel re-export of all modules.
- Fixed one TS error (duplicate `isOnColorSide` export between constants.ts and moves.ts) by removing the redundant copy from constants.ts.
- Ran `bun run lint` - clean (no errors). Ran `npx tsc --noEmit` - no errors in xiangqi files.
- Wrote and ran two smoke-test scripts (initial board, piece moves for cannon/pawn/king/knight/bishop, GameEngine class, generals facing, can't-expose-king-to-facing, AI easy/medium/hard/expert all return legal moves, expert within ~250ms, cannon check detection, 10-ply random game, hard-vs-hard). All passed. The hard-vs-hard test was particularly satisfying: the AI found a real 5-ply checkmate (cannon screen-capture creating an inescapable rook-line check), and the engine correctly terminated the game with `red-wins`.

Stage Summary:
- Produced files (all in `/home/z/my-project/src/lib/xiangqi/`):
  - `types.ts` - all shared types.
  - `constants.ts` - board/palace/river constants, piece names, values, PSTs, `createInitialBoard`, `cloneBoard`.
  - `moves.ts` - pseudo-legal move generation + check/king-facing helpers.
  - `validator.ts` - full legal move filtering, check/checkmate/stalemate detection.
  - `engine.ts` - `GameState`, pure functions, and `GameEngine` class with undo stack.
  - `ai.ts` - 4 difficulty levels with alpha-beta minimax and time guard.
  - `index.ts` - barrel export.
- Public API surface (key exports): `createGame`, `applyMove`, `undo`, `getLegalMovesFrom`, `getAllLegalMovesFrom`, `getStatus`, `GameEngine`, `createInitialBoard`/`INITIAL_BOARD`, `cloneBoard`, `getPseudoLegalMoves`, `inBoard`, `inPalace`, `isAcrossRiver`, `isOnColorSide`, `findKing`, `generalsFacing`, `isKingAttacked`, `isMoveLegal`, `getLegalMoves`, `getAllLegalMoves`, `isInCheck`, `isCheckmate`, `isStalemate`, `hasAnyLegalMove`, `applyMoveToBoard`, `evaluate`, `chooseMove`, plus all type/constant exports.
- Lint clean, TypeScript clean. Engine is pure TS (no React/DOM) and importable from both client and server.
- Caveats: (1) `evaluate` includes mobility + in-check penalty at every leaf node, so very deep searches beyond depth 3 would slow down; expert's 1.5s budget guards against this. (2) No draw detection (repetition / insufficient material / move-count) is implemented - status is only `playing`/`red-wins`/`black-wins`; UI/server can layer draw-by-agreement later if needed. (3) Undo uses full board snapshots (memory-cheap for typical games).

---
Task ID: 3-5
Agent: main (orchestrator)
Task: Build frontend UI (home, board, bot/mp screens, chat, voice), API routes, integrate, verify

Work Log:
- Fixed critical bug: engine cannon positions were wrong (row 1 col 2/7 → corrected to row 2 col 1/7 for black, row 7 col 1/7 for red), matching standard Xiangqi opening and the WS service.
- Built src/lib/socket.ts (socket.io client singleton via XTransformPort=3003).
- Built API routes: /api/ai/chat (LLM bot chat, Vietnamese), /api/voice/asr (speech→text), /api/voice/tts (text→speech wav).
- Built Board.tsx: SVG grid + palace diagonals + corner marks + river text (楚河漢界), pieces as Chinese-character discs, legal-move dots, last-move + check highlights, board flip for black viewer.
- Built HomeScreen, BotSetup, MultiplayerSetup (create/join with room ID + password, waiting screen).
- Built ChatPanel (text chat both modes + ASR voice messages in bot mode) and VoicePanel (WebRTC controls for mp).
- Built useVoiceChat hook (WebRTC P2P voice, RED offers / BLACK answers, ICE buffering, mute).
- Built GameScreen orchestrator: engine state, move legality, bot AI trigger, socket move sync, chat (LLM for bot / relay for mp), resign/draw/new-game controls, result overlays, captured pieces, move history.
- page.tsx state machine: home → bot-setup → bot-game / mp-setup → mp-game, sticky footer.
- Updated layout.tsx metadata (title: "Bàn Cờ Tướng — Xiangqi Online").

- KEY INFRASTRUCTURE FIX: background processes (the standalone mini-service) do NOT survive between bash commands in this sandbox. Solved by running the socket.io game server INSIDE the Next.js process via src/instrumentation.ts (singleton-guarded, port 3003, path "/"). Triggered a dev-server restart by editing next.config.ts so instrumentation loads. Verified gateway now routes XTransformPort=3003 → in-process socket.io server correctly.

Stage Summary:
- Agent Browser end-to-end verification PASSED:
  * Home screen renders with mode cards + rules summary.
  * Bot mode: setup → game → board renders (90 intersections) → player moves → bot responds (and captures) → chat with LLM works (Vietnamese contextual replies) → TTS for bot replies.
  * Multiplayer: Alice creates room (red) → waiting screen with room ID JEBBZV → Bob joins (black) → both enter game with correct board orientation (flipped for black) → move sync BOTH directions → chat relay works.
  * Footer sticky at bottom. Mobile viewport tested. No console/runtime errors.
- Lint: 0 errors, 1 harmless warning (eslint-disable quirk in useVoiceChat).
- Files produced: src/lib/{socket,gameServer}.ts, src/instrumentation.ts, src/app/api/{ai/chat,voice/asr,voice/tts}/route.ts, src/components/xiangqi/{Board,HomeScreen,BotSetup,MultiplayerSetup,ChatPanel,VoicePanel,GameScreen,pieces}.tsx, src/hooks/useVoiceChat.ts, src/app/page.tsx (+ layout/next.config edits).
