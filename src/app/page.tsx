'use client';

import { useState } from 'react';
import { HomeScreen } from '@/components/xiangqi/HomeScreen';
import { BotSetup } from '@/components/xiangqi/BotSetup';
import { MultiplayerSetup, type MpSession } from '@/components/xiangqi/MultiplayerSetup';
import { GameScreen } from '@/components/xiangqi/GameScreen';
import type { Color, DifficultyLevel } from '@/lib/xiangqi/types';

type Screen = 'home' | 'bot-setup' | 'mp-setup' | 'bot-game' | 'mp-game';

interface BotConfig {
  difficulty: DifficultyLevel;
  playerColor: Color;
  displayName: string;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('home');
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [mpSession, setMpSession] = useState<MpSession | null>(null);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-amber-50/40 via-background to-background">
      <main className="flex-1">
        {screen === 'home' && (
          <HomeScreen
            onSelectBot={() => setScreen('bot-setup')}
            onSelectMultiplayer={() => setScreen('mp-setup')}
          />
        )}

        {screen === 'bot-setup' && (
          <BotSetup
            onBack={() => setScreen('home')}
            onStart={(cfg) => {
              setBotConfig(cfg);
              setScreen('bot-game');
            }}
          />
        )}

        {screen === 'mp-setup' && (
          <MultiplayerSetup
            onBack={() => setScreen('home')}
            onJoined={(session) => {
              setMpSession(session);
              setScreen('mp-game');
            }}
          />
        )}

        {screen === 'bot-game' && botConfig && (
          <GameScreen
            mode="bot"
            difficulty={botConfig.difficulty}
            playerColor={botConfig.playerColor}
            displayName={botConfig.displayName}
            opponentName={`Bot ${botConfig.difficulty === 'expert' ? 'Cao thủ' : botConfig.difficulty === 'hard' ? 'Khó' : botConfig.difficulty === 'medium' ? 'Trung bình' : 'Dễ'}`}
            onExit={() => {
              setBotConfig(null);
              setScreen('home');
            }}
          />
        )}

        {screen === 'mp-game' && mpSession && (
          <GameScreen
            mode="mp"
            playerColor={mpSession.myColor}
            displayName={mpSession.myName}
            opponentName={mpSession.opponentName}
            mp={mpSession}
            onExit={() => {
              setMpSession(null);
              setScreen('home');
            }}
          />
        )}
      </main>

      <footer className="mt-auto border-t border-amber-200/60 bg-amber-50/50 py-4 text-center text-xs text-muted-foreground">
        <p>
          ♟️ Bàn Cờ Tướng · Xiangqi — chơi theo luật truyền thống · Bot nhiều cấp độ · Đấu mạng + voice chat
        </p>
      </footer>
    </div>
  );
}
