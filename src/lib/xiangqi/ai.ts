/**
 * Xiangqi - AI engine with four difficulty levels.
 *
 * All functions are SYNCHRONOUS (pure compute) so they can be called from
 * both client and server code. The AI always picks a move that maximizes
 * the score of the color it is playing.
 *
 * Evaluation convention: positive = good for Red, negative = good for Black.
 *  - Red mover: maximize evaluation.
 *  - Black mover: minimize evaluation.
 */
import { PIECE_SQUARE_TABLES, PIECE_VALUES, NUM_COLS, NUM_ROWS } from './constants';
import { getPseudoLegalMoves } from './moves';
import { applyMoveToBoard, getAllLegalMoves, isInCheck } from './validator';
import type { Board, Color, DifficultyLevel, GameState, Move } from './types';

/** Effectively-infinite sentinel for mate scores. */
const INF = 1e9;

/** Opposite color. */
function opposite(c: Color): Color {
  return c === 'red' ? 'black' : 'red';
}

/** +1 for red, -1 for black. */
function sign(c: Color): number {
  return c === 'red' ? 1 : -1;
}

/**
 * Mobility: total number of pseudo-legal destinations for the given color.
 * Used as a light positional signal.
 */
function mobility(board: Board, color: Color): number {
  let total = 0;
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      total += getPseudoLegalMoves(board, { row: r, col: c }, color).length;
    }
  }
  return total;
}

/**
 * Static evaluation of the board from Red's perspective.
 * Considers: material, piece-square tables, mobility, king safety (in-check
 * penalty), pawn advancement (baked into the pawn PST).
 * Positive = good for Red, negative = good for Black.
 */
export function evaluate(board: Board): number {
  let score = 0;
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      const s = sign(p.color);
      // Material.
      score += s * PIECE_VALUES[p.type];
      // Piece-square table. Red uses the table as-is; Black is mirrored
      // vertically (because Black's forward direction is opposite).
      const tbl = PIECE_SQUARE_TABLES[p.type];
      const row = p.color === 'red' ? r : NUM_ROWS - 1 - r;
      score += s * (tbl[row]?.[c] ?? 0);
    }
  }
  // Mobility (small weight).
  const redMobility = mobility(board, 'red');
  const blackMobility = mobility(board, 'black');
  score += (redMobility - blackMobility) * 2;
  // King safety: penalize being in check.
  if (isInCheck(board, 'red')) score -= 80;
  if (isInCheck(board, 'black')) score += 80;
  return score;
}

/** Sort moves so that captures (high-value first) come before quiet moves. */
function orderMoves(moves: Move[]): void {
  moves.sort((a, b) => {
    const av = a.captured ? PIECE_VALUES[a.captured.type] : 0;
    const bv = b.captured ? PIECE_VALUES[b.captured.type] : 0;
    return bv - av;
  });
}

/** Shared time-budget context for iterative deepening / time guard. */
interface SearchContext {
  start: number;
  maxTimeMs: number;
  timedOut: boolean;
}

/** Check whether the time budget has been exceeded. */
function timeUp(ctx: SearchContext): boolean {
  if (ctx.timedOut) return true;
  if (Date.now() - ctx.start >= ctx.maxTimeMs) {
    ctx.timedOut = true;
    return true;
  }
  return false;
}

/**
 * Minimax with alpha-beta pruning. Returns the score of the position from
 * Red's perspective (positive = good for Red). `maximizingColor` is the
 * color the search is being run for; the function alternates max/min
 * based on whose turn it is at each ply.
 */
function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  turn: Color,
  maximizingColor: Color,
  ctx: SearchContext,
): number {
  if (timeUp(ctx)) return evaluate(board);

  const moves = getAllLegalMoves(board, turn);

  // Terminal: no legal moves. The player to move loses.
  if (moves.length === 0) {
    // Prefer faster mates: bias by remaining depth.
    const mateBias = 1000 - depth * 10;
    return turn === maximizingColor ? -INF + mateBias : INF - mateBias;
  }

  if (depth === 0) {
    return evaluate(board);
  }

  orderMoves(moves);
  const isMaximizing = turn === maximizingColor;

  if (isMaximizing) {
    let best = -INF;
    for (const m of moves) {
      const nb = applyMoveToBoard(board, m);
      const val = minimax(nb, depth - 1, alpha, beta, opposite(turn), maximizingColor, ctx);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
      if (timeUp(ctx)) break;
    }
    return best;
  }
  let best = INF;
  for (const m of moves) {
    const nb = applyMoveToBoard(board, m);
    const val = minimax(nb, depth - 1, alpha, beta, opposite(turn), maximizingColor, ctx);
    if (val < best) best = val;
    if (best < beta) beta = best;
    if (beta <= alpha) break;
    if (timeUp(ctx)) break;
  }
  return best;
}

/**
 * Choose the best move at the root for the given color using minimax with
 * alpha-beta to the specified depth. Returns the best-so-far if the time
 * budget is exceeded.
 */
function chooseMinimax(
  board: Board,
  turn: Color,
  depth: number,
  maxTimeMs: number,
  useOrdering: boolean,
): Move | null {
  const moves = getAllLegalMoves(board, turn);
  if (moves.length === 0) return null;
  if (useOrdering) orderMoves(moves);

  const ctx: SearchContext = { start: Date.now(), maxTimeMs, timedOut: false };
  const isMaximizing = turn === 'red';
  let alpha = -INF;
  let beta = INF;
  let bestVal = isMaximizing ? -INF : INF;
  let bestMove: Move = moves[0];

  for (const m of moves) {
    const nb = applyMoveToBoard(board, m);
    const val = minimax(nb, depth - 1, alpha, beta, opposite(turn), turn, ctx);
    if (isMaximizing) {
      if (val > bestVal) {
        bestVal = val;
        bestMove = m;
      }
      if (bestVal > alpha) alpha = bestVal;
    } else {
      if (val < bestVal) {
        bestVal = val;
        bestMove = m;
      }
      if (bestVal < beta) beta = bestVal;
    }
    if (timeUp(ctx)) break;
  }
  return bestMove;
}

/**
 * Easy: pick a uniformly random legal move.
 */
function chooseEasy(moves: Move[]): Move {
  return moves[Math.floor(Math.random() * moves.length)];
}

/**
 * Medium: greedy 1-ply. Evaluate each legal move by the resulting static
 * evaluation and pick the best for the mover. Ties are broken randomly.
 */
function chooseMedium(board: Board, moves: Move[], turn: Color): Move {
  const isMaximizing = turn === 'red';
  let bestVal = isMaximizing ? -INF : INF;
  let bestMoves: Move[] = [];
  for (const m of moves) {
    const nb = applyMoveToBoard(board, m);
    const val = evaluate(nb);
    if (isMaximizing) {
      if (val > bestVal) {
        bestVal = val;
        bestMoves = [m];
      } else if (val === bestVal) {
        bestMoves.push(m);
      }
    } else {
      if (val < bestVal) {
        bestVal = val;
        bestMoves = [m];
      } else if (val === bestVal) {
        bestMoves.push(m);
      }
    }
  }
  if (bestMoves.length === 0) return moves[0];
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

/**
 * Top-level AI entry point. Returns the chosen move for the side to move
 * in `state`, or null if there is no legal move (game is over).
 *
 *  - 'easy'   : random legal move.
 *  - 'medium' : greedy 1-ply with tie-break randomness.
 *  - 'hard'   : minimax + alpha-beta, depth 2.
 *  - 'expert' : minimax + alpha-beta, depth 3, move ordering, time guard.
 *
 * `maxTimeMs` (default 1500) bounds the wall-clock time for expert; if
 * exceeded, the best move found so far is returned.
 */
export function chooseMove(
  state: GameState,
  level: DifficultyLevel,
  maxTimeMs = 1500,
): Move | null {
  if (state.status !== 'playing') return null;
  const moves = getAllLegalMoves(state.board, state.turn);
  if (moves.length === 0) return null;

  switch (level) {
    case 'easy':
      return chooseEasy(moves);
    case 'medium':
      return chooseMedium(state.board, moves, state.turn);
    case 'hard':
      return chooseMinimax(state.board, state.turn, 2, maxTimeMs, false);
    case 'expert':
      return chooseMinimax(state.board, state.turn, 3, maxTimeMs, true);
    default:
      return chooseEasy(moves);
  }
}
