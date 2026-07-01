/**
 * Xiangqi - Move validation, check / checkmate / stalemate detection.
 *
 * A move is fully "legal" if:
 *   1. It is pseudo-legal (obeys the piece movement rules).
 *   2. After making it, the mover's own king is not in check.
 *   3. After making it, the two generals are not facing each other on an
 *      open file.
 */
import { cloneBoard, NUM_COLS, NUM_ROWS } from './constants';
import {
  findKing,
  generalsFacing,
  getPseudoLegalMoves,
  isKingAttacked,
} from './moves';
import type { Board, Color, Move, Position } from './types';

/** Apply a move to a cloned board (does not mutate the input). */
export function applyMoveToBoard(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  const piece = next[move.from.row][move.from.col];
  next[move.to.row][move.to.col] = piece;
  next[move.from.row][move.from.col] = null;
  return next;
}

/** Find the king of the given color, or null. Re-exported for convenience. */
export { findKing };

/** True if the king of `color` is attacked by the opponent. */
export function isInCheck(board: Board, color: Color): boolean {
  return isKingAttacked(board, color);
}

/** True if the two generals face each other on an open file. */
export { generalsFacing };

/**
 * Return the fully legal destination squares for the piece at `from`.
 * Filters out pseudo-legal moves that leave own king in check or that
 * expose the two kings to a facing position.
 */
export function getLegalMoves(board: Board, from: Position, color: Color): Position[] {
  const piece = board[from.row][from.col];
  if (!piece || piece.color !== color) return [];

  const pseudo = getPseudoLegalMoves(board, from, color);
  const legal: Position[] = [];
  for (const dest of pseudo) {
    const move: Move = { from, to: dest };
    if (isMoveLegal(board, move, color)) legal.push(dest);
  }
  return legal;
}

/**
 * Validate a specific move: pseudo-legal, doesn't leave own king in check,
 * and doesn't create a generals-facing position.
 */
export function isMoveLegal(board: Board, move: Move, color: Color): boolean {
  const piece = board[move.from.row][move.from.col];
  if (!piece || piece.color !== color) return false;

  // Verify pseudo-legal destination.
  const pseudo = getPseudoLegalMoves(board, move.from, color);
  const found = pseudo.some((p) => p.row === move.to.row && p.col === move.to.col);
  if (!found) return false;

  // Apply the move on a cloned board and ensure own king is safe and kings
  // are not facing.
  const next = applyMoveToBoard(board, move);
  if (isKingAttacked(next, color)) return false;
  if (generalsFacing(next)) return false;
  return true;
}

/**
 * Generate all fully-legal moves for the given color.
 */
export function getAllLegalMoves(board: Board, color: Color): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      const from: Position = { row: r, col: c };
      const dests = getLegalMoves(board, from, color);
      for (const to of dests) {
        const captured = board[to.row][to.col] ?? undefined;
        moves.push({ from, to, captured });
      }
    }
  }
  return moves;
}

/**
 * True if `color` is in check AND has no legal move (checkmate).
 * Per Xiangqi rules, checkmate ends the game with a win for the mover.
 */
export function isCheckmate(board: Board, color: Color): boolean {
  if (!isInCheck(board, color)) return false;
  return getAllLegalMoves(board, color).length === 0;
}

/**
 * True if `color` is NOT in check AND has no legal move.
 * Per Xiangqi rule 8 ("Hết nước đi"), a player with no legal move loses.
 */
export function isStalemate(board: Board, color: Color): boolean {
  if (isInCheck(board, color)) return false;
  return getAllLegalMoves(board, color).length === 0;
}

/**
 * True if `color` has at least one legal move.
 */
export function hasAnyLegalMove(board: Board, color: Color): boolean {
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      const dests = getLegalMoves(board, { row: r, col: c }, color);
      if (dests.length > 0) return true;
    }
  }
  return false;
}
