/**
 * Piece visual data: Chinese-character glyphs (traditional Xiangqi) per color,
 * plus Vietnamese names and color tokens for styling.
 */
import type { Color, PieceType } from '@/lib/xiangqi/types';
import { PIECE_NAMES_VI } from '@/lib/xiangqi/constants';

/** Traditional Chinese-character glyphs shown on each piece disc. */
export const PIECE_GLYPHS: Record<Color, Record<PieceType, string>> = {
  red: { K: '帥', A: '仕', B: '相', N: '傌', R: '俥', C: '炮', P: '兵' },
  black: { K: '將', A: '士', B: '象', N: '馬', R: '車', C: '砲', P: '卒' },
};

/** Vietnamese short label (for legends / captured list). */
export function pieceLabel(color: Color, type: PieceType): string {
  return PIECE_NAMES_VI[type];
}

/** Tailwind class fragments for a piece disc by color. */
export function pieceDiscClasses(color: Color): string {
  return color === 'red'
    ? 'bg-gradient-to-b from-amber-50 to-amber-100 text-red-700 border-red-700'
    : 'bg-gradient-to-b from-amber-50 to-amber-100 text-stone-900 border-stone-900';
}

/** Difficulty metadata for the UI. */
export const DIFFICULTIES: {
  value: 'easy' | 'medium' | 'hard' | 'expert';
  label: string;
  desc: string;
  icon: string;
}[] = [
  { value: 'easy', label: 'Dễ', desc: 'Đi nước ngẫu nhiên — phù hợp người mới', icon: '🌱' },
  { value: 'medium', label: 'Trung bình', desc: 'Thích ăn quân, đơn giản', icon: '⚔️' },
  { value: 'hard', label: 'Khó', desc: 'Tính trước 2 nước (minimax)', icon: '🔥' },
  { value: 'expert', label: 'Cao thủ', desc: 'Tính sâu 3 nước + đánh giá thế cờ', icon: '👑' },
];
