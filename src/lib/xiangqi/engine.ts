/**
 * Xiangqi - Game engine: state container, move application, undo, status.
 *
 * Provides BOTH a `GameEngine` class (mutable wrapper) AND a set of pure
 * functions that operate on `GameState`. The pure functions never mutate
 * their inputs; `applyMove` and `undo` return new `GameState` objects.
 */
import { cloneBoard, createInitialBoard } from './constants';
import { getAllLegalMoves, getLegalMoves, isMoveLegal } from './validator';
import type {
  Board,
  Color,
  GameStatus,
  GameState,
  Move,
  Piece,
  Position,
} from './types';

/** Create a fresh game: standard opening position, red to move. */
export function createGame(): GameState {
  return {
    board: createInitialBoard(),
    turn: 'red',
    history: [],
    status: 'playing',
    captured: [],
    privateSnapshots: [],
    privateTurns: [],
    privateStatuses: [],
    privateCapturedLens: [],
  };
}

/** Compute the resulting GameStatus after the move has just been applied. */
function computeStatusAfterMove(board: Board, nextTurn: Color): GameStatus {
  // The player to move next loses if they have no legal move at all
  // (this covers both checkmate and the no-legal-move rule).
  const moves = getAllLegalMoves(board, nextTurn);
  if (moves.length === 0) {
    // Mover (the opposite of nextTurn) wins.
    return nextTurn === 'red' ? 'black-wins' : 'red-wins';
  }
  return 'playing';
}

/**
 * Apply a move and return a new GameState. Validates the move; throws if
 * illegal (so callers can detect bad input). Turn is toggled and status
 * is recomputed (checkmate / no-legal-move => mover wins).
 */
export function applyMove(state: GameState, move: Move): GameState {
  if (state.status !== 'playing') {
    throw new Error(`Cannot apply move: game is already ${state.status}`);
  }
  // Enforce turn.
  const piece = state.board[move.from.row][move.from.col];
  if (!piece || piece.color !== state.turn) {
    throw new Error(`Cannot apply move: it is ${state.turn}'s turn`);
  }
  if (!isMoveLegal(state.board, move, state.turn)) {
    throw new Error('Cannot apply move: illegal move');
  }

  const captured: Piece | undefined = state.board[move.to.row][move.to.col] ?? undefined;

  // Build new board.
  const newBoard = cloneBoard(state.board);
  newBoard[move.to.row][move.to.col] = newBoard[move.from.row][move.from.col];
  newBoard[move.from.row][move.from.col] = null;

  const nextTurn: Color = state.turn === 'red' ? 'black' : 'red';
  const status = computeStatusAfterMove(newBoard, nextTurn);

  const newState: GameState = {
    board: newBoard,
    turn: nextTurn,
    history: [...state.history, { ...move, captured }],
    status,
    captured: captured ? [...state.captured, captured] : [...state.captured],
    privateSnapshots: [...(state.privateSnapshots ?? []), cloneBoard(state.board)],
    privateTurns: [...(state.privateTurns ?? []), state.turn],
    privateStatuses: [...(state.privateStatuses ?? []), state.status],
    privateCapturedLens: [...(state.privateCapturedLens ?? []), state.captured.length],
  };
  return newState;
}

/**
 * Undo the last move. Returns a new state. If there is nothing to undo,
 * returns the state unchanged.
 */
export function undo(state: GameState): GameState {
  if ((state.privateSnapshots?.length ?? 0) === 0) return state;
  const snapshots = [...(state.privateSnapshots ?? [])];
  const turns = [...(state.privateTurns ?? [])];
  const statuses = [...(state.privateStatuses ?? [])];
  const lens = [...(state.privateCapturedLens ?? [])];

  const prevBoard = snapshots.pop()!;
  const prevTurn = turns.pop()!;
  const prevStatus = statuses.pop()!;
  const prevLen = lens.pop()!;

  const history = [...state.history];
  history.pop();

  return {
    board: prevBoard,
    turn: prevTurn,
    history,
    status: prevStatus,
    captured: state.captured.slice(0, prevLen),
    privateSnapshots: snapshots,
    privateTurns: turns,
    privateStatuses: statuses,
    privateCapturedLens: lens,
  };
}

/** Get all legal destination squares for the piece at `from` in `state`. */
export function getLegalMovesFrom(state: GameState, from: Position): Position[] {
  if (state.status !== 'playing') return [];
  return getLegalMoves(state.board, from, state.turn);
}

/** Get all legal moves for the player to move in `state`. */
export function getAllLegalMovesFrom(state: GameState): Move[] {
  if (state.status !== 'playing') return [];
  return getAllLegalMoves(state.board, state.turn);
}

/** Return the current status of the game. */
export function getStatus(state: GameState): GameStatus {
  return state.status;
}

/**
 * A small mutable wrapper around `GameState` for ergonomic, OOP-style usage.
 * Internally delegates to the pure functions above.
 */
export class GameEngine {
  private state: GameState;

  constructor(initial?: GameState) {
    this.state = initial ?? createGame();
  }

  /** Current (readonly) state snapshot. */
  getSnapshot(): GameState {
    return this.state;
  }

  /** Current board. */
  get board(): Board {
    return this.state.board;
  }

  /** Whose turn it is. */
  get turn(): Color {
    return this.state.turn;
  }

  /** Current status. */
  get status(): GameStatus {
    return this.state.status;
  }

  /** History of moves. */
  get history(): Move[] {
    return this.state.history;
  }

  /** Captured pieces, in order of capture. */
  get captured(): Piece[] {
    return this.state.captured;
  }

  /** Apply a move (mutates this engine). Returns true on success. */
  move(move: Move): boolean {
    try {
      this.state = applyMove(this.state, move);
      return true;
    } catch {
      return false;
    }
  }

  /** Undo the last move. Returns true if something was undone. */
  undoMove(): boolean {
    const before = this.state.history.length;
    this.state = undo(this.state);
    return this.state.history.length !== before;
  }

  /** Reset to a fresh game. */
  reset(): void {
    this.state = createGame();
  }

  /** Get all legal destination squares from a square. */
  legalMovesFrom(from: Position): Position[] {
    return getLegalMovesFrom(this.state, from);
  }

  /** Get all legal moves for the current player. */
  allLegalMoves(): Move[] {
    return getAllLegalMovesFrom(this.state);
  }

  /** True if the move is currently legal. */
  isLegal(move: Move): boolean {
    if (this.state.status !== 'playing') return false;
    const piece = this.state.board[move.from.row][move.from.col];
    if (!piece || piece.color !== this.state.turn) return false;
    return isMoveLegal(this.state.board, move, this.state.turn);
  }
}
