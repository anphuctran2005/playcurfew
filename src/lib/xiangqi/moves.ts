/**
 * Xiangqi - Pseudo-legal move generation.
 *
 * "Pseudo-legal" means the destination obeys the piece's movement rules
 * (palace bounds, river rules, blocking, cannon screen, pawn direction, etc.),
 * but we do NOT check whether the move leaves the own king in check or
 * creates a king-facing position. Those checks live in `validator.ts`.
 */
import { BLACK_PALACE, NUM_COLS, NUM_ROWS, RED_PALACE, RIVER_BOTTOM_ROW, RIVER_TOP_ROW } from './constants';
import type { Board, Color, Piece, Position } from './types';

/** True if the position is inside the 9x10 board. */
export function inBoard(pos: Position): boolean {
  return pos.row >= 0 && pos.row < NUM_ROWS && pos.col >= 0 && pos.col < NUM_COLS;
}

/** True if the position is inside the palace of the given color. */
export function inPalace(pos: Position, color: Color): boolean {
  const b = color === 'red' ? RED_PALACE : BLACK_PALACE;
  return pos.row >= b.rowMin && pos.row <= b.rowMax && pos.col >= b.colMin && pos.col <= b.colMax;
}

/**
 * True if a pawn of the given color at `pos` has crossed the river.
 * - Red pawn crosses when reaching rows 0..4 (Black side).
 * - Black pawn crosses when reaching rows 5..9 (Red side).
 */
export function isAcrossRiver(pos: Position, color: Color): boolean {
  if (color === 'red') return pos.row <= RIVER_TOP_ROW; // rows 0..4
  return pos.row >= RIVER_BOTTOM_ROW; // rows 5..9
}

/** True if the position is on the given color's own side of the river. */
export function isOnColorSide(pos: Position, color: Color): boolean {
  return !isAcrossRiver(pos, color);
}

/** Find the position of the king (Tướng) of the given color, or null. */
export function findKing(board: Board, color: Color): Position | null {
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const p = board[r][c];
      if (p && p.type === 'K' && p.color === color) return { row: r, col: c };
    }
  }
  return null;
}

/**
 * Detect "two generals facing each other on the same file with no piece
 * between them". Such a position is illegal in Xiangqi.
 */
export function generalsFacing(board: Board): boolean {
  const redKing = findKing(board, 'red');
  const blackKing = findKing(board, 'black');
  if (!redKing || !blackKing) return false;
  if (redKing.col !== blackKing.col) return false;
  const minR = Math.min(redKing.row, blackKing.row);
  const maxR = Math.max(redKing.row, blackKing.row);
  for (let r = minR + 1; r < maxR; r++) {
    if (board[r][redKing.col]) return false; // a piece blocks the line of sight
  }
  return true;
}

/** Orthogonal direction vectors. */
const ORTHO_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Diagonal direction vectors. */
const DIAG_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Get the piece at a position (or null if off-board / empty). */
function pieceAt(board: Board, pos: Position): Piece | null {
  if (!inBoard(pos)) return null;
  return board[pos.row][pos.col];
}

/** King: 1 step orthogonal, must stay in palace. */
function getKingMoves(board: Board, from: Position, color: Color): Position[] {
  const out: Position[] = [];
  for (const [dr, dc] of ORTHO_DIRS) {
    const to: Position = { row: from.row + dr, col: from.col + dc };
    if (!inBoard(to) || !inPalace(to, color)) continue;
    const p = board[to.row][to.col];
    if (!p || p.color !== color) out.push(to);
  }
  return out;
}

/** Advisor (Sĩ): 1 step diagonal, must stay in palace. */
function getAdvisorMoves(board: Board, from: Position, color: Color): Position[] {
  const out: Position[] = [];
  for (const [dr, dc] of DIAG_DIRS) {
    const to: Position = { row: from.row + dr, col: from.col + dc };
    if (!inBoard(to) || !inPalace(to, color)) continue;
    const p = board[to.row][to.col];
    if (!p || p.color !== color) out.push(to);
  }
  return out;
}

/** Bishop (Tượng): 2-step diagonal, cannot cross river, eye square must be empty. */
function getBishopMoves(board: Board, from: Position, color: Color): Position[] {
  const out: Position[] = [];
  for (const [dr, dc] of DIAG_DIRS) {
    const to: Position = { row: from.row + dr * 2, col: from.col + dc * 2 };
    if (!inBoard(to)) continue;
    // Bishop cannot cross the river.
    if (!isOnColorSide(to, color)) continue;
    // Eye (middle) square must be empty.
    const eye: Position = { row: from.row + dr, col: from.col + dc };
    if (board[eye.row][eye.col]) continue;
    const p = board[to.row][to.col];
    if (!p || p.color !== color) out.push(to);
  }
  return out;
}

/** Knight (Mã): L-shape, blocked by the adjacent square ("leg") in the moving direction. */
function getKnightMoves(board: Board, from: Position, color: Color): Position[] {
  // Each entry: [destination delta, leg delta].
  const defs: ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]> = [
    [[2, 1], [1, 0]],
    [[2, -1], [1, 0]],
    [[-2, 1], [-1, 0]],
    [[-2, -1], [-1, 0]],
    [[1, 2], [0, 1]],
    [[-1, 2], [0, 1]],
    [[1, -2], [0, -1]],
    [[-1, -2], [0, -1]],
  ];
  const out: Position[] = [];
  for (const [toDelta, legDelta] of defs) {
    const to: Position = { row: from.row + toDelta[0], col: from.col + toDelta[1] };
    if (!inBoard(to)) continue;
    const leg: Position = { row: from.row + legDelta[0], col: from.col + legDelta[1] };
    // Leg must be empty.
    if (board[leg.row][leg.col]) continue;
    const p = board[to.row][to.col];
    if (!p || p.color !== color) out.push(to);
  }
  return out;
}

/** Rook (Xe): slides orthogonally, blocked by any piece; can capture opponent. */
function getRookMoves(board: Board, from: Position, color: Color): Position[] {
  const out: Position[] = [];
  for (const [dr, dc] of ORTHO_DIRS) {
    let r = from.row + dr;
    let c = from.col + dc;
    while (inBoard({ row: r, col: c })) {
      const p = board[r][c];
      if (!p) {
        out.push({ row: r, col: c });
      } else {
        if (p.color !== color) out.push({ row: r, col: c });
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return out;
}

/**
 * Cannon (Pháo): slides like rook for non-capturing moves; to capture,
 * exactly one piece (the "screen") must be between cannon and target.
 */
function getCannonMoves(board: Board, from: Position, color: Color): Position[] {
  const out: Position[] = [];
  for (const [dr, dc] of ORTHO_DIRS) {
    let r = from.row + dr;
    let c = from.col + dc;
    let screenFound = false;
    while (inBoard({ row: r, col: c })) {
      const p = board[r][c];
      if (!screenFound) {
        if (!p) {
          // Empty square: non-capturing slide.
          out.push({ row: r, col: c });
        } else {
          // First piece becomes the screen.
          screenFound = true;
        }
      } else {
        // After the screen: first piece we hit is the target (capture if enemy).
        if (p) {
          if (p.color !== color) out.push({ row: r, col: c });
          break;
        }
      }
      r += dr;
      c += dc;
    }
  }
  return out;
}

/**
 * Pawn (Tốt):
 * - Red moves toward row 0 (forward = -1). Black moves toward row 9 (forward = +1).
 * - Before crossing river: only forward 1.
 * - After crossing river: forward 1 or sideways 1. Never backward.
 */
function getPawnMoves(board: Board, from: Position, color: Color): Position[] {
  const out: Position[] = [];
  const forward = color === 'red' ? -1 : 1;
  const crossed = isAcrossRiver(from, color);

  // Forward step.
  const fwd: Position = { row: from.row + forward, col: from.col };
  if (inBoard(fwd)) {
    const p = board[fwd.row][fwd.col];
    if (!p || p.color !== color) out.push(fwd);
  }

  // Sideways steps only after crossing the river.
  if (crossed) {
    for (const dc of [-1, 1]) {
      const side: Position = { row: from.row, col: from.col + dc };
      if (!inBoard(side)) continue;
      const p = board[side.row][side.col];
      if (!p || p.color !== color) out.push(side);
    }
  }
  return out;
}

/**
 * Return all pseudo-legal destination squares for the piece at `from`
 * belonging to `color`. Returns an empty array if the square is empty,
 * off-board, or contains an opponent piece.
 */
export function getPseudoLegalMoves(board: Board, from: Position, color: Color): Position[] {
  if (!inBoard(from)) return [];
  const piece = board[from.row][from.col];
  if (!piece || piece.color !== color) return [];

  switch (piece.type) {
    case 'K':
      return getKingMoves(board, from, color);
    case 'A':
      return getAdvisorMoves(board, from, color);
    case 'B':
      return getBishopMoves(board, from, color);
    case 'N':
      return getKnightMoves(board, from, color);
    case 'R':
      return getRookMoves(board, from, color);
    case 'C':
      return getCannonMoves(board, from, color);
    case 'P':
      return getPawnMoves(board, from, color);
    default:
      return [];
  }
}

/**
 * Check whether the king of `color` is currently attacked by the opponent,
 * considering piece movement rules. Uses the standard approach of generating
 * opponent pseudo-legal moves and seeing if any lands on the king's square.
 */
export function isKingAttacked(board: Board, color: Color): boolean {
  const king = findKing(board, color);
  if (!king) return true; // No king on board = treat as captured/lost.
  const opponent: Color = color === 'red' ? 'black' : 'red';

  // Quick checks by attack pattern (faster than full move generation,
  // and avoids recursion concerns with king-facing).
  // 1. Rook / King straight-line attack on king's row/col.
  // 2. Cannon screen attack on king's row/col.
  // 3. Knight attack.
  // 4. Pawn attack.
  // 5. Advisor / Bishop never attack the king's square (they can't reach
  //    outside their camp in a way that hits the king on its palace square
  //    unless the king is itself on a diagonal-adjacent square inside the
  //    enemy palace - extremely rare and covered by the brute force below).

  // For correctness and simplicity, brute-force scan all opponent pieces.
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const p = board[r][c];
      if (!p || p.color !== opponent) continue;
      const dests = getPseudoLegalMoves(board, { row: r, col: c }, opponent);
      for (const d of dests) {
        if (d.row === king.row && d.col === king.col) return true;
      }
    }
  }
  return false;
}

/** Helper exported for tests. */
export { pieceAt };
