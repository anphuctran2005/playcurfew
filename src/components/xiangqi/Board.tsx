'use client';

/**
 * Xiangqi board: 9 cols x 10 rows of intersections, with river, palaces,
 * position marks, and pieces rendered as clickable discs.
 *
 * The board is drawn with an SVG (crisp at any size) and pieces are
 * absolutely-positioned buttons overlaid on top, so interaction stays simple.
 */
import { useMemo } from 'react';
import type { Board as BoardT, Color, Move, Position } from '@/lib/xiangqi/types';
import { PIECE_GLYPHS, pieceDiscClasses } from './pieces';

interface BoardProps {
  board: BoardT;
  /** Whose pieces the current viewer can interact with (their color). */
  viewerColor: Color;
  /** Whose turn it is. */
  turn: Color;
  /** Currently selected square (a piece of viewerColor). */
  selected: Position | null;
  /** Legal destinations for the selected piece. */
  legalMoves: Position[];
  /** Last move (for highlighting). */
  lastMove: Move | null;
  /** Squares currently giving check to the side-to-move's king. */
  checkSquare: Position | null;
  /** Whether interaction is allowed right now (e.g. not during bot thinking). */
  interactive: boolean;
  /** Called when the user clicks an intersection. */
  onSquareClick: (pos: Position) => void;
}

// Board geometry in SVG units. Intersection (col,row) -> (50+col*100, 50+row*100).
const M = 50; // margin
const S = 100; // cell size
const W = 50 + 8 * 100 + 50; // 900
const H = 50 + 9 * 100 + 50; // 1000

function posToXY(pos: Position, flip: boolean): { x: number; y: number } {
  const col = pos.col;
  const row = flip ? 9 - pos.row : pos.row;
  return { x: M + col * S, y: M + row * S };
}

/** Small L-shaped corner brackets marking cannon/pawn points. */
function CornerMark({ x, y }: { x: number; y: number }) {
  const arm = 8;
  const gap = 6;
  const stroke = '#6b3f1d';
  const sw = 2;
  // four corner brackets (skip ones that would fall off the board edge)
  const corners: { dx: number; dy: number; h: number; v: number }[] = [
    { dx: -1, dy: -1, h: -1, v: -1 }, // top-left
    { dx: 1, dy: -1, h: 1, v: -1 }, // top-right
    { dx: -1, dy: 1, h: -1, v: 1 }, // bottom-left
    { dx: 1, dy: 1, h: 1, v: 1 }, // bottom-right
  ];
  return (
    <g>
      {corners.map((c, i) => {
        const cx = x + c.dx * gap;
        const cy = y + c.dy * gap;
        const onEdge = (c.dx === -1 && x <= M) || (c.dx === 1 && x >= W - M);
        if (onEdge) return null;
        return (
          <path
            key={i}
            d={`M ${cx} ${cy} l ${c.h * arm} 0 M ${cx} ${cy} l 0 ${c.v * arm}`}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

export function Board({
  board,
  viewerColor,
  turn,
  selected,
  legalMoves,
  lastMove,
  checkSquare,
  interactive,
  onSquareClick,
}: BoardProps) {
  const flip = viewerColor === 'black';

  // Precompute the grid lines, palace diagonals, corner marks (static).
  const staticLayer = useMemo(() => {
    const vLines = [];
    for (let c = 0; c < 9; c++) {
      vLines.push(
        <line
          key={`v${c}`}
          x1={M + c * S}
          y1={M}
          x2={M + c * S}
          y2={M + 9 * S}
          stroke="#5b3211"
          strokeWidth={c === 0 || c === 8 ? 2.5 : 1.5}
        />
      );
    }
    const hLines = [];
    for (let r = 0; r < 10; r++) {
      hLines.push(
        <line
          key={`h${r}`}
          x1={M}
          y1={M + r * S}
          x2={M + 8 * S}
          y2={M + r * S}
          stroke="#5b3211"
          strokeWidth={r === 0 || r === 9 ? 2.5 : 1.5}
        />
      );
    }
    // Palace diagonals (not flipped — they're symmetric across the river).
    const palaces = [
      { r1: 0, r2: 2, c1: 3, c2: 5 },
      { r1: 7, r2: 9, c1: 3, c2: 5 },
    ];
    const diagonals = palaces.map((p, i) => (
      <g key={`pal${i}`}>
        <line
          x1={M + p.c1 * S}
          y1={M + p.r1 * S}
          x2={M + p.c2 * S}
          y2={M + p.r2 * S}
          stroke="#5b3211"
          strokeWidth={1.5}
        />
        <line
          x1={M + p.c2 * S}
          y1={M + p.r1 * S}
          x2={M + p.c1 * S}
          y2={M + p.r2 * S}
          stroke="#5b3211"
          strokeWidth={1.5}
        />
      </g>
    ));
    // Corner marks at cannons & pawns.
    const marks: { r: number; c: number }[] = [
      { r: 2, c: 1 }, { r: 2, c: 7 }, { r: 7, c: 1 }, { r: 7, c: 7 },
      { r: 3, c: 0 }, { r: 3, c: 2 }, { r: 3, c: 4 }, { r: 3, c: 6 }, { r: 3, c: 8 },
      { r: 6, c: 0 }, { r: 6, c: 2 }, { r: 6, c: 4 }, { r: 6, c: 6 }, { r: 6, c: 8 },
    ];
    const cornerMarks = marks.map((m) => {
      const rr = flip ? 9 - m.r : m.r;
      return <CornerMark key={`m${m.r}-${m.c}`} x={M + m.c * S} y={M + rr * S} />;
    });
    return { vLines, hLines, diagonals, cornerMarks };
  }, [flip]);

  // Build the rendered rows (with flip applied) so pieces & click targets line up.
  const rows = flip ? [...Array(10).keys()].reverse() : [...Array(10).keys()];

  const legalSet = new Set(legalMoves.map((p) => `${p.row},${p.col}`));

  return (
    <div
      className="relative w-full select-none rounded-xl shadow-2xl ring-1 ring-amber-900/30"
      style={{
        aspectRatio: `${W} / ${H}`,
        background:
          'linear-gradient(135deg, #f1d9a8 0%, #e8c47a 45%, #dcb367 100%)',
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 h-full w-full"
        aria-label="Bàn cờ tướng"
      >
        {/* River text */}
        <text
          x={M + 2 * S}
          y={M + 4.6 * S}
          textAnchor="middle"
          fontSize={42}
          fill="#7a4a1f"
          opacity={0.55}
          letterSpacing={14}
          fontFamily="serif"
        >
          楚河
        </text>
        <text
          x={M + 6 * S}
          y={M + 4.6 * S}
          textAnchor="middle"
          fontSize={42}
          fill="#7a4a1f"
          opacity={0.55}
          letterSpacing={14}
          fontFamily="serif"
        >
          漢界
        </text>

        {/* Grid */}
        {staticLayer.vLines}
        {staticLayer.hLines}
        {staticLayer.diagonals}
        {staticLayer.cornerMarks}

        {/* Last move highlight */}
        {lastMove && (
          <>
            {(() => {
              const f = posToXY(lastMove.from, flip);
              const t = posToXY(lastMove.to, flip);
              return (
                <>
                  <circle cx={f.x} cy={f.y} r={30} fill="none" stroke="#16a34a" strokeWidth={3} opacity={0.7} />
                  <circle cx={t.x} cy={t.y} r={30} fill="none" stroke="#16a34a" strokeWidth={3} opacity={0.9} />
                </>
              );
            })()}
          </>
        )}

        {/* Check highlight on the attacked king */}
        {checkSquare && (
          (() => {
            const k = posToXY(checkSquare, flip);
            return (
              <circle cx={k.x} cy={k.y} r={34} fill="none" stroke="#dc2626" strokeWidth={3.5} opacity={0.9}>
                <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1s" repeatCount="indefinite" />
              </circle>
            );
          })()
        )}

        {/* Legal-move dots */}
        {legalMoves.map((p) => {
          const { x, y } = posToXY(p, flip);
          const occupant = board[p.row][p.col];
          return (
            <g key={`lm${p.row}-${p.col}`}>
              {occupant ? (
                <circle cx={x} cy={y} r={34} fill="none" stroke="#16a34a" strokeWidth={3} opacity={0.85} />
              ) : (
                <circle cx={x} cy={y} r={13} fill="#16a34a" opacity={0.55} />
              )}
            </g>
          );
        })}
      </svg>

      {/* Click targets + pieces as HTML overlay for crisp interaction & text */}
      <div className="absolute inset-0">
        {rows.map((r) =>
          [...Array(9).keys()].map((c) => {
            const col = c;
            const row = r;
            const piece = board[row][col];
            const isSelected = selected && selected.row === row && selected.col === col;
            const { x, y } = posToXY({ row, col }, flip);
            const leftPct = (x / W) * 100;
            const topPct = (y / H) * 100;
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                aria-label={`${row},${col}`}
                onClick={() => onSquareClick({ row, col })}
                disabled={!interactive}
                className="absolute flex items-center justify-center rounded-full focus:outline-none"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: '11%',
                  aspectRatio: '1 / 1',
                  transform: 'translate(-50%, -50%)',
                  cursor: interactive ? 'pointer' : 'default',
                }}
              >
                {piece && (
                  <span
                    className={`flex h-[88%] w-[88%] items-center justify-center rounded-full border-2 shadow-md transition-transform ${
                      pieceDiscClasses(piece.color)
                    } ${isSelected ? 'ring-4 ring-emerald-500 scale-110' : ''} ${
                      interactive && piece.color === viewerColor && turn === viewerColor
                        ? 'hover:scale-105'
                        : ''
                    }`}
                    style={{
                      fontFamily: '"STKaiti","KaiTi","SimSun",serif',
                      fontWeight: 700,
                      fontSize: 'clamp(0.9rem, 3.4vw, 1.7rem)',
                      boxShadow:
                        'inset 0 1px 2px rgba(255,255,255,0.7), inset 0 -2px 4px rgba(0,0,0,0.18), 0 2px 4px rgba(0,0,0,0.25)',
                      background:
                        piece.color === 'red'
                          ? 'radial-gradient(circle at 35% 30%, #fffaf0, #f3e0b3 70%, #e6c98a)'
                          : 'radial-gradient(circle at 35% 30%, #fffaf0, #f3e0b3 70%, #e6c98a)',
                    }}
                  >
                    {PIECE_GLYPHS[piece.color][piece.type]}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default Board;
