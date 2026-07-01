'use client';

/**
 * GameScreen — the main in-game layout for both bot and multiplayer modes.
 * Renders the board + a side panel (status, captured, history, controls, chat, voice).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Flag, Handshake, RotateCcw, Loader2, Volume2, VolumeX, MessagesSquare, Radio,
} from 'lucide-react';
import { toast } from 'sonner';
import { Board } from './Board';
import { ChatPanel, type ChatMsg } from './ChatPanel';
import { VoicePanel } from './VoicePanel';
import { PIECE_GLYPHS, DIFFICULTIES } from './pieces';
import {
  createGame, applyMove, getLegalMovesFrom, isInCheck, findKing, chooseMove,
} from '@/lib/xiangqi';
import type {
  Color, DifficultyLevel, GameStatus, GameState, Move, Piece, Position,
} from '@/lib/xiangqi/types';
import type { MpSession } from './MultiplayerSetup';
import { getSocket, disconnectSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

interface GameScreenProps {
  mode: 'bot' | 'mp';
  difficulty?: DifficultyLevel;
  playerColor: Color;
  displayName: string;
  opponentName: string;
  mp?: MpSession | null;
  onExit: () => void;
}

let msgId = 0;
const newId = () => `m${++msgId}`;

export function GameScreen({
  mode, difficulty, playerColor, displayName, opponentName, mp, onExit,
}: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>(() => createGame());
  const [selected, setSelected] = useState<Position | null>(null);
  const [legalMoves, setLegalMoves] = useState<Position[]>([]);
  const [thinking, setThinking] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [botVoiceOn, setBotVoiceOn] = useState(true);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [drawOfferedBy, setDrawOfferedBy] = useState<Color | null>(null);
  const [resultStatus, setResultStatus] = useState<GameStatus | 'resign-red' | 'resign-black' | 'draw' | null>(null);

  const socketRef = useRef<Socket | null>(mode === 'mp' ? getSocket() : null);
  const stateRef = useRef(gameState);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);
  const botVoiceRef = useRef(botVoiceOn);
  useEffect(() => { botVoiceRef.current = botVoiceOn; }, [botVoiceOn]);
  const playerColorRef = useRef(playerColor);
  const chatRef = useRef(chat);
  useEffect(() => { chatRef.current = chat; }, [chat]);

  const botColor: Color = playerColor === 'red' ? 'black' : 'red';

  // ----- derived -----
  const lastMove = gameState.history.length
    ? gameState.history[gameState.history.length - 1]
    : null;
  const myTurn = gameState.turn === playerColor && gameState.status === 'playing' && !resultStatus;
  const interactive = mode === 'bot' ? (myTurn && !thinking) : (myTurn && !opponentLeft);
  const sideToMoveInCheck = useMemo(
    () => (gameState.status === 'playing' ? isInCheck(gameState.board, gameState.turn) : false),
    [gameState],
  );
  const checkSquare = useMemo<Position | null>(() => {
    if (!sideToMoveInCheck) return null;
    return findKing(gameState.board, gameState.turn);
  }, [sideToMoveInCheck, gameState.board]);

  // ----- bot move trigger -----
  const triggerBotMove = useCallback((state: GameState) => {
    if (state.status !== 'playing') return;
    if (state.turn !== botColor) return;
    setThinking(true);
    // Defer so the UI can paint the player's move first.
    setTimeout(() => {
      try {
        const move = chooseMove(state, difficulty || 'medium');
        if (move) {
          const next = applyMove(state, move);
          setGameState(next);
        }
      } catch (e) {
        console.error('bot move error', e);
      } finally {
        setThinking(false);
      }
    }, 450);
  }, [botColor, difficulty]);

  // If player is black in bot mode, bot (red) moves first.
  useEffect(() => {
    if (mode === 'bot' && playerColor === 'black') {
      triggerBotMove(gameState);
    }
    // run once on mount only
  }, []);

  // ----- move making -----
  const performMove = useCallback((move: Move) => {
    const state = stateRef.current;
    if (state.status !== 'playing') return;
    let next: GameState;
    try {
      next = applyMove(state, move);
    } catch (e) {
      console.error('illegal move', e);
      return;
    }
    setGameState(next);
    setSelected(null);
    setLegalMoves([]);

    if (mode === 'mp' && mp && socketRef.current) {
      socketRef.current.emit('make-move', { roomId: mp.roomId, move: { from: move.from, to: move.to } });
    } else if (mode === 'bot') {
      triggerBotMove(next);
    }
  }, [mode, mp, triggerBotMove]);

  // ----- click handling -----
  const onSquareClick = useCallback((pos: Position) => {
    if (!interactive) return;
    const state = stateRef.current;
    const piece = state.board[pos.row][pos.col];

    // If clicking a legal destination → move.
    if (selected && legalMoves.some((p) => p.row === pos.row && p.col === pos.col)) {
      performMove({ from: selected, to: pos });
      return;
    }
    // If clicking own piece → select it.
    if (piece && piece.color === playerColor && state.turn === playerColor) {
      setSelected(pos);
      setLegalMoves(getLegalMovesFrom(state, pos));
      return;
    }
    // otherwise clear selection
    setSelected(null);
    setLegalMoves([]);
  }, [interactive, selected, legalMoves, performMove, playerColor]);

  // ----- socket listeners (mp mode) -----
  useEffect(() => {
    if (mode !== 'mp' || !mp) return;
    const socket = socketRef.current;
    if (!socket) return;

    const onOpponentMove = (payload: { move: Move; by: Color }) => {
      const state = stateRef.current;
      // Apply opponent's move to local state.
      try {
        const next = applyMove(state, payload.move);
        setGameState(next);
      } catch (e) {
        console.error('failed to apply opponent move', e);
      }
    };
    const onGameOver = (payload: { reason: string; winner?: Color }) => {
      if (payload.reason === 'draw') {
        setResultStatus('draw');
      } else if (payload.reason === 'resign' && payload.winner) {
        setResultStatus(payload.winner === 'red' ? 'resign-black' : 'resign-red');
      }
    };
    const onOpponentLeft = () => {
      setOpponentLeft(true);
      toast.error('Đối thủ đã rời phòng.');
    };
    const onDrawOffered = (payload: { from: Color }) => {
      setDrawOfferedBy(payload.from);
      toast.info('Đối thủ đề nghị hòa. Hãy chấp nhận hoặc từ chối.');
    };
    const onDrawDeclined = () => {
      setDrawOfferedBy(null);
      toast.error('Đối thủ từ chối hòa.');
    };

    socket.on('opponent-move', onOpponentMove);
    socket.on('game-over', onGameOver);
    socket.on('opponent-left', onOpponentLeft);
    socket.on('draw-offered', onDrawOffered);
    socket.on('draw-declined', onDrawDeclined);

    return () => {
      socket.off('opponent-move', onOpponentMove);
      socket.off('game-over', onGameOver);
      socket.off('opponent-left', onOpponentLeft);
      socket.off('draw-offered', onDrawOffered);
      socket.off('draw-declined', onDrawDeclined);
    };
  }, [mode, mp]);

  // ----- chat (mp) -----
  useEffect(() => {
    if (mode !== 'mp' || !mp) return;
    const socket = socketRef.current;
    if (!socket) return;
    const onChat = (payload: { from: string; color: Color; message: string }) => {
      setChat((prev) => [
        ...prev,
        { id: newId(), from: payload.from, color: payload.color, text: payload.message, ts: Date.now() },
      ]);
    };
    socket.on('chat-message', onChat);
    return () => { socket.off('chat-message', onChat); };
  }, [mode, mp]);

  // ----- result detection from engine status -----
  useEffect(() => {
    if (gameState.status === 'red-wins') setResultStatus((prev) => prev ?? 'red-wins');
    else if (gameState.status === 'black-wins') setResultStatus((prev) => prev ?? 'black-wins');
  }, [gameState.status]);

  // ----- chat send -----
  const sendChat = useCallback(async (text: string) => {
    // Add my message immediately.
    setChat((prev) => [
      ...prev,
      { id: newId(), from: displayName, color: playerColor, text, ts: Date.now() },
    ]);
    if (mode === 'mp' && mp && socketRef.current) {
      socketRef.current.emit('chat-message', { roomId: mp.roomId, message: text });
      return;
    }
    // bot mode → call LLM, then speak with TTS.
    try {
      const mood = sideToMoveInCheck ? 'đối thủ đang bị chiếu' : thinking ? 'bot đang nghĩ nước đi' : 'đang chơi bình thường';
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mood }),
      });
      const data = await res.json();
      const reply: string = data.reply || '...';
      setChat((prev) => [
        ...prev,
        { id: newId(), from: opponentName, color: botColor, text: reply, ts: Date.now() },
      ]);
      if (botVoiceRef.current) {
        // fire-and-forget TTS
        fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: reply, voice: 'tongtong', speed: 1.0 }),
        })
          .then((r) => r.blob())
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => URL.revokeObjectURL(url);
            audio.play().catch(() => {});
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error('bot chat error', e);
    }
  }, [mode, mp, displayName, playerColor, opponentName, botColor, sideToMoveInCheck, thinking]);

  // ----- controls -----
  const handleResign = () => {
    if (mode === 'mp' && mp && socketRef.current) {
      socketRef.current.emit('resign', { roomId: mp.roomId });
      setResultStatus(playerColor === 'red' ? 'resign-red' : 'resign-black');
    } else {
      setResultStatus(playerColor === 'red' ? 'resign-red' : 'resign-black');
    }
  };
  const handleNewGame = () => {
    const fresh = createGame();
    setGameState(fresh);
    setSelected(null);
    setLegalMoves([]);
    setResultStatus(null);
    setOpponentLeft(false);
    setDrawOfferedBy(null);
    if (mode === 'bot' && playerColor === 'black') {
      triggerBotMove(fresh);
    }
  };
  const handleLeaveMp = () => {
    if (mp && socketRef.current) {
      socketRef.current.emit('leave-room', { roomId: mp.roomId });
    }
    disconnectSocket();
    socketRef.current = null;
    onExit();
  };
  const handleOfferDraw = () => {
    if (mode === 'mp' && mp && socketRef.current) {
      socketRef.current.emit('offer-draw', { roomId: mp.roomId });
      toast.success('Đã gửi lời đề nghị hòa.');
    }
  };
  const handleAcceptDraw = () => {
    if (mode === 'mp' && mp && socketRef.current) {
      socketRef.current.emit('accept-draw', { roomId: mp.roomId });
    }
    setDrawOfferedBy(null);
  };
  const handleDeclineDraw = () => {
    if (mode === 'mp' && mp && socketRef.current) {
      socketRef.current.emit('decline-draw', { roomId: mp.roomId });
    }
    setDrawOfferedBy(null);
  };

  // ----- result text -----
  const resultText = (() => {
    if (!resultStatus) return null;
    if (resultStatus === 'draw') return 'Hòa!';
    if (resultStatus === 'resign-red') return 'Đỏ đầu hàng — Đen thắng!';
    if (resultStatus === 'resign-black') return 'Đen đầu hàng — Đỏ thắng!';
    if (resultStatus === 'red-wins') return 'Đỏ thắng!';
    if (resultStatus === 'black-wins') return 'Đen thắng!';
    return null;
  })();
  const playerWon =
    resultStatus &&
    ((resultStatus === 'red-wins' || resultStatus === 'resign-black') && playerColor === 'red') ||
    ((resultStatus === 'black-wins' || resultStatus === 'resign-red') && playerColor === 'black');

  // ----- captured pieces split -----
  const capturedByRed = gameState.captured.filter((p) => p.color === 'black');
  const capturedByBlack = gameState.captured.filter((p) => p.color === 'red');
  const myCaptured = playerColor === 'red' ? capturedByRed : capturedByBlack;

  const diffLabel = DIFFICULTIES.find((d) => d.value === difficulty)?.label;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      {/* top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={mode === 'mp' ? handleLeaveMp : onExit}>
          <ArrowLeft className="h-4 w-4" /> Thoát
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
            {mode === 'bot' ? `🤖 Bot · ${diffLabel}` : '👥 Đấu mạng'}
          </Badge>
          {sideToMoveInCheck && gameState.status === 'playing' && (
            <Badge className="animate-pulse bg-red-600 text-white">CHIẾU!</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Board column */}
        <div className="space-y-3">
          {/* Opponent label */}
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${
                  playerColor === 'red'
                    ? 'border-stone-900 bg-amber-50 text-stone-900'
                    : 'border-red-700 bg-amber-50 text-red-700'
                }`}
              >
                {playerColor === 'red' ? '將' : '帥'}
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">{opponentName}</p>
                <p className="text-xs text-muted-foreground">
                  {playerColor === 'red' ? 'Quân Đen' : 'Quân Đỏ'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {mode === 'bot' && thinking && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> đang nghĩ…
                </span>
              )}
              {gameState.turn === botColor && gameState.status === 'playing' && (
                <Badge variant="secondary" className="text-xs">Đến lượt đối thủ</Badge>
              )}
            </div>
          </div>

          {/* The board */}
          <Board
            board={gameState.board}
            viewerColor={playerColor}
            turn={gameState.turn}
            selected={selected}
            legalMoves={legalMoves}
            lastMove={lastMove}
            checkSquare={checkSquare}
            interactive={interactive}
            onSquareClick={onSquareClick}
          />

          {/* Player label */}
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${
                  playerColor === 'red'
                    ? 'border-red-700 bg-amber-50 text-red-700'
                    : 'border-stone-900 bg-amber-50 text-stone-900'
                }`}
              >
                {playerColor === 'red' ? '帥' : '將'}
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">{displayName} (bạn)</p>
                <p className="text-xs text-muted-foreground">
                  {playerColor === 'red' ? 'Quân Đỏ' : 'Quân Đen'}
                </p>
              </div>
            </div>
            {gameState.turn === playerColor && gameState.status === 'playing' && (
              <Badge className="bg-red-700 text-white">Đến lượt bạn</Badge>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-3">
          {/* Status + captured + controls */}
          <Card className="border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Trận đấu</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Nước #{gameState.history.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* captured */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Quân bạn bắt được:</p>
                <div className="flex min-h-[28px] flex-wrap gap-1">
                  {myCaptured.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    myCaptured.map((p, i) => (
                      <span
                        key={i}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                          p.color === 'red'
                            ? 'border-red-700 text-red-700'
                            : 'border-stone-900 text-stone-900'
                        }`}
                        style={{ background: 'radial-gradient(circle at 35% 30%, #fffaf0, #e6c98a)' }}
                      >
                        {PIECE_GLYPHS[p.color][p.type]}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <Separator />

              {/* controls */}
              <div className="flex flex-wrap gap-2">
                {mode === 'bot' ? (
                  <Button size="sm" variant="outline" onClick={handleNewGame}>
                    <RotateCcw className="h-4 w-4" /> Ván mới
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleOfferDraw} disabled={!!resultStatus}>
                    <Handshake className="h-4 w-4" /> Cầu hòa
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleResign}
                  disabled={!!resultStatus}
                >
                  <Flag className="h-4 w-4" /> Đầu hàng
                </Button>
              </div>

              {/* draw offer actions */}
              {drawOfferedBy && drawOfferedBy !== playerColor && (
                <div className="rounded-md bg-amber-50 p-2 text-xs">
                  <p className="mb-2 text-amber-900">Đối thủ đề nghị hòa. Đồng ý?</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAcceptDraw}>Đồng ý</Button>
                    <Button size="sm" variant="outline" onClick={handleDeclineDraw}>Từ chối</Button>
                  </div>
                </div>
              )}

              {/* bot voice toggle */}
              {mode === 'bot' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start text-xs"
                  onClick={() => setBotVoiceOn((v) => !v)}
                >
                  {botVoiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  Bot đọc giọng nói: {botVoiceOn ? 'Bật' : 'Tắt'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Move history */}
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Lịch sử nước đi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-36 overflow-y-auto pr-1 text-xs">
                {gameState.history.length === 0 ? (
                  <p className="text-muted-foreground">Chưa có nước đi.</p>
                ) : (
                  <ol className="space-y-0.5">
                    {gameState.history.map((m, i) => {
                      const p = gameState.history[i];
                      const piece = p.captured
                        ? null
                        : null;
                      void piece;
                      const moverColor = i % 2 === 0 ? 'red' : 'black';
                      // reconstruct piece type from board? we know from captured? simpler: just show coords
                      return (
                        <li key={i} className="flex gap-2">
                          <span className="w-6 text-muted-foreground">{i + 1}.</span>
                          <span className={moverColor === 'red' ? 'text-red-700' : 'text-stone-700'}>
                            {moverColor === 'red' ? 'Đỏ' : 'Đen'}
                          </span>
                          <span className="text-muted-foreground">
                            ({m.from.row},{m.from.col})→({m.to.row},{m.to.col})
                          </span>
                          {p.captured && (
                            <span className="text-emerald-700">
                              ăn {PIECE_GLYPHS[p.captured.color][p.captured.type]}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chat + Voice tabs */}
          <Card className="border-amber-200">
            <CardContent className="pt-4">
              <Tabs defaultValue="chat">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chat">
                    <MessagesSquare className="h-4 w-4" /> Chat
                  </TabsTrigger>
                  <TabsTrigger value="voice">
                    <Radio className="h-4 w-4" /> Voice
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="chat" className="mt-3 h-[260px]">
                  <ChatPanel
                    messages={chat}
                    onSend={sendChat}
                    enableVoiceMessage={mode === 'bot'}
                    myColor={playerColor}
                    disabled={mode === 'mp' && opponentLeft}
                  />
                </TabsContent>
                <TabsContent value="voice" className="mt-3">
                  {mode === 'mp' ? (
                    <VoicePanel
                      socket={socketRef.current}
                      roomId={mp?.roomId ?? null}
                      myColor={playerColor}
                    />
                  ) : (
                    <div className="space-y-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-semibold">Voice với Bot</p>
                      <p>
                        Ở chế độ chơi với Bot, bạn có thể gửi <b>tin nhắn thoại</b> ở tab Chat
                        (nút 🎤) — giọng nói sẽ được chuyển thành văn bản. Bot sẽ đáp lại bằng
                        văn bản và <b>đọc thành tiếng</b> (bật/tắt ở trên).
                      </p>
                      <p className="text-muted-foreground">
                        Voice chat thời gian thực (WebRTC) chỉ dùng cho chế độ Đấu với bạn bè.
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Result overlay */}
      {resultText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-sm border-2 border-amber-300 text-center">
            <CardHeader>
              <CardTitle className="text-3xl">{playerWon ? '🏆 Chiến thắng!' : '💀 Thua cuộc'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg text-muted-foreground">{resultText}</p>
              <div className="flex flex-col gap-2">
                {mode === 'bot' ? (
                  <Button className="bg-red-800 text-white hover:bg-red-900" onClick={handleNewGame}>
                    <RotateCcw className="h-4 w-4" /> Chơi ván mới
                  </Button>
                ) : (
                  <Button className="bg-red-800 text-white hover:bg-red-900" onClick={handleLeaveMp}>
                    Rời phòng
                  </Button>
                )}
                <Button variant="outline" onClick={mode === 'mp' ? handleLeaveMp : onExit}>
                  Về trang chủ
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Opponent-left overlay (mp) */}
      {opponentLeft && !resultStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-sm border-2 border-amber-300 text-center">
            <CardHeader>
              <CardTitle>Đối thủ đã rời phòng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">Bạn có thể rời phòng để trở về trang chủ.</p>
              <Button className="w-full bg-red-800 text-white hover:bg-red-900" onClick={handleLeaveMp}>
                Rời phòng
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default GameScreen;
