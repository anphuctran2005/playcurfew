'use client';

/**
 * BotSetup — choose difficulty, your color, and display name before starting a bot game.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Play } from 'lucide-react';
import { DIFFICULTIES } from './pieces';
import type { Color } from '@/lib/xiangqi/types';
import type { DifficultyLevel } from '@/lib/xiangqi/types';

interface BotSetupProps {
  onStart: (config: {
    difficulty: DifficultyLevel;
    playerColor: Color;
    displayName: string;
  }) => void;
  onBack: () => void;
}

export function BotSetup({ onStart, onBack }: BotSetupProps) {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [playerColor, setPlayerColor] = useState<Color>('red');
  const [name, setName] = useState('');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </button>

      <Card className="border-2 border-amber-200">
        <CardHeader>
          <CardTitle className="text-2xl text-red-900">Thiết lập trận với Bot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Tên của bạn</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Kỳ thủ"
              maxLength={20}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Chọn màu quân</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPlayerColor('red')}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  playerColor === 'red'
                    ? 'border-red-600 bg-red-50 shadow-md'
                    : 'border-amber-200 bg-white hover:border-red-300'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-block h-5 w-5 rounded-full border-2 border-red-700 bg-amber-50 text-center text-[10px] leading-4 text-red-700">
                    帥
                  </span>
                  <span className="font-semibold text-red-800">Đỏ (đi trước)</span>
                </div>
                <p className="text-xs text-muted-foreground">Bạn đi nước đầu tiên.</p>
              </button>
              <button
                type="button"
                onClick={() => setPlayerColor('black')}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  playerColor === 'black'
                    ? 'border-stone-800 bg-stone-100 shadow-md'
                    : 'border-amber-200 bg-white hover:border-stone-400'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-block h-5 w-5 rounded-full border-2 border-stone-900 bg-amber-50 text-center text-[10px] leading-4 text-stone-900">
                    將
                  </span>
                  <span className="font-semibold text-stone-800">Đen (đi sau)</span>
                </div>
                <p className="text-xs text-muted-foreground">Bot đi trước, bạn đáp trả.</p>
              </button>
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <Label>Cấp độ Bot</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(d.value)}
                  className={`rounded-xl border-2 p-3 text-left transition-all ${
                    difficulty === d.value
                      ? 'border-amber-500 bg-amber-50 shadow-md'
                      : 'border-amber-200 bg-white hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{d.icon}</span>
                    <span className="font-semibold text-stone-800">{d.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Button
            size="lg"
            className="w-full bg-red-800 text-white hover:bg-red-900"
            onClick={() =>
              onStart({
                difficulty,
                playerColor,
                displayName: name.trim() || 'Kỳ thủ',
              })
            }
          >
            <Play className="h-5 w-5" /> Bắt đầu trận
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default BotSetup;
