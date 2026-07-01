/**
 * Xiangqi (Chinese Chess / Cờ Tướng) - Core Type Definitions
 *
 * Board coordinate system:
 * - 9 columns (0..8) x 10 rows (0..9).
 * - Row 0 = top = Black's back rank. Row 9 = bottom = Red's back rank.
 * - River is between row 4 and row 5. Black side = rows 0..4, Red side = rows 5..9.
 * - Red palace: cols 3..5, rows 7..9. Black palace: cols 3..5, rows 0..2.
 */

/** Piece color. */
export type Color = 'red' | 'black';

/** Piece type code (uppercase). */
export type PieceType = 'K' | 'A' | 'B' | 'N' | 'R' | 'C' | 'P';

/** A piece on the board. */
export interface Piece {
  type: PieceType;
  color: Color;
}

/** A board coordinate. row 0..9, col 0..8. */
export interface Position {
  row: number;
  col: number;
}

/** A move from one square to another, optionally capturing a piece. */
export interface Move {
  from: Position;
  to: Position;
  /** Captured piece, if any. */
  captured?: Piece;
}

/** High-level game status. */
export type GameStatus = 'playing' | 'red-wins' | 'black-wins' | 'draw';

/** A 10x9 grid of (Piece | null). board[row][col]. */
export type Board = (Piece | null)[][];

/** AI difficulty levels. */
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

/** Mutable game state used by the engine. */
export interface GameState {
  /** 10x9 board, board[row][col]. */
  board: Board;
  /** Whose turn it is. */
  turn: Color;
  /** Move history (oldest first). */
  history: Move[];
  /** Current game status. */
  status: GameStatus;
  /** Captured pieces (in order of capture). */
  captured: Piece[];
  /** Stack of board snapshots for undo (deep-cloned). */
  privateSnapshots?: Board[];
  /** Stack of previous turns for undo. */
  privateTurns?: Color[];
  /** Stack of previous statuses for undo. */
  privateStatuses?: GameStatus[];
  /** Stack of previous captured-list lengths (so we can trim). */
  privateCapturedLens?: number[];
}
