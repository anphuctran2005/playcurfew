'use client';

/**
 * MultiplayerSetup — create or join a private room with ID + password.
 * Manages the socket connection and, on `game-start`, hands a session to the parent.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Copy, Loader2, LogIn, Plus, Users, Hash, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import type { Color } from '@/lib/xiangqi/types';

export interface MpSession {
  roomId: string;
  myColor: Color;
  myName: string;
  opponentName: string;
}

interface MultiplayerSetupProps {
  onJoined: (session: MpSession) => void;
  onBack: () => void;
}

export function MultiplayerSetup({ onJoined, onBack }: MultiplayerSetupProps) {
  const [tab, setTab] = useState<'create' | 'join'>('create');

  // create form
  const [createName, setCreateName] = useState('');
  const [createPass, setCreatePass] = useState('');

  // join form
  const [joinName, setJoinName] = useState('');
  const [joinRoom, setJoinRoom] = useState('');
  const [joinPass, setJoinPass] = useState('');

  const [busy, setBusy] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState<string | null>(null);
  const myColorRef = useRef<Color>('red');
  const myNameRef = useRef<string>('');
  const socketRef = useRef(getSocket());

  // Listen for game-start to transition into the game.
  useEffect(() => {
    const socket = socketRef.current;
    const onGameStart = (payload: {
      roomId: string;
      red: { id: string; name: string };
      black: { id: string; name: string };
    }) => {
      const myColor = myColorRef.current;
      const myName = myNameRef.current;
      const opponentName = myColor === 'red' ? payload.black.name : payload.red.name;
      onJoined({
        roomId: payload.roomId,
        myColor,
        myName,
        opponentName,
      });
    };
    socket.on('game-start', onGameStart);
    return () => {
      socket.off('game-start', onGameStart);
    };
  }, [onJoined]);

  const handleCreate = () => {
    if (!createName.trim()) {
      toast.error('Vui lòng nhập tên.');
      return;
    }
    if (!createPass.trim()) {
      toast.error('Vui lòng nhập mật khẩu phòng.');
      return;
    }
    const socket = socketRef.current;
    if (!socket.connected) {
      toast.error('Đang kết nối tới máy chủ… hãy thử lại.');
      return;
    }
    setBusy(true);
    myColorRef.current = 'red';
    myNameRef.current = createName.trim();
    socket.removeAllListeners('create-room-result');
    socket.once('create-room-result', (res: { ok: boolean; room?: { roomId: string }; error?: string }) => {
      setBusy(false);
      if (res.ok && res.room) {
        setWaitingRoom(res.room.roomId);
        toast.success('Đã tạo phòng! Chia sẻ mã phòng và mật khẩu cho bạn bè.');
      } else {
        toast.error(res.error || 'Không tạo được phòng.');
      }
    });
    socket.emit('create-room', {
      password: createPass.trim(),
      displayName: createName.trim(),
    });
  };

  const handleJoin = () => {
    if (!joinName.trim()) {
      toast.error('Vui lòng nhập tên.');
      return;
    }
    if (!joinRoom.trim()) {
      toast.error('Vui lòng nhập mã phòng.');
      return;
    }
    if (!joinPass.trim()) {
      toast.error('Vui lòng nhập mật khẩu.');
      return;
    }
    const socket = socketRef.current;
    if (!socket.connected) {
      toast.error('Đang kết nối tới máy chủ… hãy thử lại.');
      return;
    }
    setBusy(true);
    myColorRef.current = 'black';
    myNameRef.current = joinName.trim();
    socket.removeAllListeners('join-room-result');
    socket.once('join-room-result', (res: { ok: boolean; color?: Color; error?: string }) => {
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error || 'Không tham gia được phòng.');
      }
      // on success, game-start will fire and trigger onJoined.
    });
    socket.emit('join-room', {
      roomId: joinRoom.trim().toUpperCase(),
      password: joinPass.trim(),
      displayName: joinName.trim(),
    });
  };

  const copyRoom = () => {
    if (waitingRoom) {
      navigator.clipboard.writeText(waitingRoom);
      toast.success('Đã sao chép mã phòng.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </button>

      <Card className="border-2 border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-stone-900">
            <Users className="h-6 w-6" /> Đấu với bạn bè
          </CardTitle>
        </CardHeader>
        <CardContent>
          {waitingRoom ? (
            /* Waiting screen */
            <div className="space-y-5 text-center">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <Loader2 className="h-8 w-8 animate-spin text-amber-700" />
              </div>
              <div>
                <p className="text-lg font-semibold text-stone-800">Đang chờ đối thủ…</p>
                <p className="text-sm text-muted-foreground">
                  Chia sẻ mã phòng &amp; mật khẩu bên dưới để bạn bè tham gia.
                </p>
              </div>
              <div className="mx-auto max-w-xs space-y-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
                <div>
                  <Label className="flex items-center justify-center gap-1 text-xs text-amber-800">
                    <Hash className="h-3 w-3" /> Mã phòng
                  </Label>
                  <div className="mt-1 flex items-center justify-center gap-2">
                    <span className="text-2xl font-bold tracking-widest text-red-800">
                      {waitingRoom}
                    </span>
                    <Button size="icon" variant="ghost" onClick={copyRoom} title="Sao chép">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="border-t border-amber-200 pt-2">
                  <Label className="flex items-center justify-center gap-1 text-xs text-amber-800">
                    <Lock className="h-3 w-3" /> Mật khẩu
                  </Label>
                  <div className="mt-1 text-lg font-semibold text-stone-800">{createPass}</div>
                </div>
              </div>
              <Button variant="outline" onClick={onBack}>
                Hủy phòng
              </Button>
            </div>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'create' | 'join')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">
                  <Plus className="h-4 w-4" /> Tạo phòng
                </TabsTrigger>
                <TabsTrigger value="join">
                  <LogIn className="h-4 w-4" /> Tham gia
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cName">Tên của bạn</Label>
                  <Input
                    id="cName"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="VD: Kỳ thủ đỏ"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cPass">Mật khẩu phòng</Label>
                  <Input
                    id="cPass"
                    value={createPass}
                    onChange={(e) => setCreatePass(e.target.value)}
                    placeholder="Đặt mật khẩu để bảo vệ phòng"
                  />
                  <p className="text-xs text-muted-foreground">
                    Bạn sẽ chơi quân Đỏ (đi trước). Mã phòng được tạo tự động.
                  </p>
                </div>
                <Button
                  className="w-full bg-red-800 text-white hover:bg-red-900"
                  onClick={handleCreate}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Tạo phòng mới
                </Button>
              </TabsContent>

              <TabsContent value="join" className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="jName">Tên của bạn</Label>
                  <Input
                    id="jName"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="VD: Kỳ thủ đen"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jRoom">Mã phòng</Label>
                  <Input
                    id="jRoom"
                    value={joinRoom}
                    onChange={(e) => setJoinRoom(e.target.value.toUpperCase())}
                    placeholder="VD: A1B2C3"
                    className="font-mono uppercase tracking-widest"
                    maxLength={8}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jPass">Mật khẩu phòng</Label>
                  <Input
                    id="jPass"
                    value={joinPass}
                    onChange={(e) => setJoinPass(e.target.value)}
                    placeholder="Nhập mật khẩu của phòng"
                  />
                  <p className="text-xs text-muted-foreground">
                    Bạn sẽ chơi quân Đen. Nhập đúng mã &amp; mật khẩu để vào phòng.
                  </p>
                </div>
                <Button
                  className="w-full bg-stone-800 text-white hover:bg-stone-900"
                  onClick={handleJoin}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  Tham gia phòng
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default MultiplayerSetup;
