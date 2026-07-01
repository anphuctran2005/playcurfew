/**
 * Xiangqi - Constants: board dimensions, palace bounds, initial setup,
 * piece display names, piece values, and piece-square tables for AI.
 */
import type { Board, Color, Piece, PieceType, Position } from './types';

/** Board dimensions. */
export const NUM_ROWS = 10;
export const NUM_COLS = 9;

/** Top-most river boundary (Black side ends at row 4, Red side starts at row 5). */
export const RIVER_TOP_ROW = 4;
export const RIVER_BOTTOM_ROW = 5;

/** Palace bounds (inclusive). */
export const RED_PALACE = { rowMin: 7, rowMax: 9, colMin: 3, colMax: 5 } as const;
export const BLACK_PALACE = { rowMin: 0, rowMax: 2, colMin: 3, colMax: 5 } as const;

/** Vietnamese display names for each piece type. */
export const PIECE_NAMES_VI: Record<PieceType, string> = {
  K: 'Tướng',
  A: 'Sĩ',
  B: 'Tượng',
  N: 'Mã',
  R: 'Xe',
  C: 'Pháo',
  P: 'Tốt',
};

/** Material values used for AI evaluation (positive). */
export const PIECE_VALUES: Record<PieceType, number> = {
  K: 10000,
  R: 900,
  C: 450,
  N: 400,
  B: 200,
  A: 200,
  P: 100,
};

/**
 * Piece-square tables (from Red's perspective, row 0 = top = Black side).
 * Values are small positional bonuses. Mirror for Black.
 *
 * Tables are intentionally simple and tuned for reasonable AI play.
 * Row order is row 0 (top) -> row 9 (bottom).
 */
export const PIECE_SQUARE_TABLES: Record<PieceType, number[][]> = {
  // King: encourage staying central in palace.
  K: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 2, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // Advisor: small central bonus in palace.
  A: [
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
  ],
  // Bishop: defensive, stay near own side.
  B: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // Knight: central & forward.
  N: [
    [-2, 0, 2, 2, 2, 2, 2, 0, -2],
    [0, 2, 4, 4, 4, 4, 4, 2, 0],
    [2, 4, 6, 8, 8, 8, 6, 4, 2],
    [2, 4, 6, 8, 8, 8, 6, 4, 2],
    [2, 4, 6, 8, 8, 8, 6, 4, 2],
    [2, 4, 6, 8, 8, 8, 6, 4, 2],
    [2, 4, 6, 8, 8, 8, 6, 4, 2],
    [2, 4, 6, 8, 8, 8, 6, 4, 2],
    [0, 2, 4, 4, 4, 4, 4, 2, 0],
    [-2, 0, 2, 2, 2, 2, 2, 0, -2],
  ],
  // Rook: very central & open files.
  R: [
    [10, 10, 10, 14, 16, 14, 10, 10, 10],
    [8, 8, 8, 12, 14, 12, 8, 8, 8],
    [6, 6, 6, 10, 12, 10, 6, 6, 6],
    [4, 4, 4, 8, 10, 8, 4, 4, 4],
    [2, 2, 2, 6, 8, 6, 2, 2, 2],
    [2, 2, 2, 6, 8, 6, 2, 2, 2],
    [4, 4, 4, 8, 10, 8, 4, 4, 4],
    [6, 6, 6, 10, 12, 10, 6, 6, 6],
    [8, 8, 8, 12, 14, 12, 8, 8, 8],
    [10, 10, 10, 14, 16, 14, 10, 10, 10],
  ],
  // Cannon: central, also king-rank pressure.
  C: [
    [6, 6, 6, 8, 10, 8, 6, 6, 6],
    [6, 6, 6, 8, 10, 8, 6, 6, 6],
    [4, 4, 4, 6, 8, 6, 4, 4, 4],
    [4, 4, 4, 6, 8, 6, 4, 4, 4],
    [2, 2, 2, 4, 6, 4, 2, 2, 2],
    [2, 2, 2, 4, 6, 4, 2, 2, 2],
    [4, 4, 4, 6, 8, 6, 4, 4, 4],
    [4, 4, 4, 6, 8, 6, 4, 4, 4],
    [6, 6, 6, 8, 10, 8, 6, 6, 6],
    [6, 6, 6, 8, 10, 8, 6, 6, 6],
  ],
  // Pawn: reward advancing across river, especially central files.
  P: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [4, 0, 4, 0, 8, 0, 4, 0, 4],
    [6, 0, 6, 0, 12, 0, 6, 0, 6],
    [8, 0, 8, 0, 16, 0, 8, 0, 8],
    [10, 0, 10, 0, 20, 0, 10, 0, 10],
    [12, 0, 12, 0, 24, 0, 12, 0, 12],
  ],
};

/**
 * Create a fresh 10x9 board with the standard Xiangqi opening position.
 * Red on rows 5..9 (bottom), Black on rows 0..4 (top). Red moves first.
 */
export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: NUM_ROWS }, () =>
    Array.from({ length: NUM_COLS }, () => null as Piece | null),
  );

  const backRank: PieceType[] = ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R'];

  // Black back rank at row 0.
  for (let c = 0; c < NUM_COLS; c++) {
    board[0][c] = { type: backRank[c], color: 'black' };
  }
  // Black cannons at (2,1) and (2,7) — standard Xiangqi opening.
  board[2][1] = { type: 'C', color: 'black' };
  board[2][7] = { type: 'C', color: 'black' };
  // Black pawns at row 3 cols 0,2,4,6,8.
  for (const c of [0, 2, 4, 6, 8]) {
    board[3][c] = { type: 'P', color: 'black' };
  }

  // Red back rank at row 9.
  for (let c = 0; c < NUM_COLS; c++) {
    board[9][c] = { type: backRank[c], color: 'red' };
  }
  // Red cannons at (7,1) and (7,7) — standard Xiangqi opening.
  board[7][1] = { type: 'C', color: 'red' };
  board[7][7] = { type: 'C', color: 'red' };
  // Red pawns at row 6 cols 0,2,4,6,8.
  for (const c of [0, 2, 4, 6, 8]) {
    board[6][c] = { type: 'P', color: 'red' };
  }

  return board;
}

/**
 * Convenience alias kept for compatibility with the spec name `INITIAL_BOARD`.
 * Returns a fresh board each call (boards are mutable, so we must clone).
 */
export const INITIAL_BOARD = createInitialBoard;

/** Deep-clone a board (so callers can mutate safely). */
export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}
