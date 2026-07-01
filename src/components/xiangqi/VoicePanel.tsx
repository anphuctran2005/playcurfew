'use client';

/**
 * VoicePanel — real-time WebRTC voice chat controls (multiplayer mode).
 * Wraps the useVoiceChat hook and renders mic / status UI.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, PhoneCall, PhoneOff, Volume2, Loader2 } from 'lucide-react';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import type { Socket } from 'socket.io-client';
import type { Color } from '@/lib/xiangqi/types';

interface VoicePanelProps {
  socket: Socket | null;
  roomId: string | null;
  myColor: Color;
}

const STATE_LABEL: Record<string, { text: string; tone: string }> = {
  idle: { text: 'Tắt', tone: 'bg-muted text-muted-foreground' },
  ready: { text: 'Sẵn sàng', tone: 'bg-amber-100 text-amber-800' },
  connecting: { text: 'Đang kết nối…', tone: 'bg-amber-100 text-amber-800' },
  active: { text: 'Đang trò chuyện', tone: 'bg-emerald-100 text-emerald-800' },
  failed: { text: 'Lỗi', tone: 'bg-red-100 text-red-800' },
};

export function VoicePanel({ socket, roomId, myColor }: VoicePanelProps) {
  const [enabled, setEnabled] = useState(false);
  const { callState, micOn, error, remoteAudioRef, toggleMute } = useVoiceChat({
    socket,
    roomId,
    myColor,
    enabled,
  });

  const stateInfo = STATE_LABEL[callState] || STATE_LABEL.idle;

  return (
    <div className="space-y-2">
      {/* hidden audio sink for the remote stream */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-amber-700" />
          <span className="text-sm font-medium">Voice chat (thời gian thực)</span>
        </div>
        <Badge className={`${stateInfo.tone} border-0`} variant="secondary">
          {stateInfo.text}
        </Badge>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!enabled ? (
          <Button
            type="button"
            size="sm"
            onClick={() => setEnabled(true)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            <PhoneCall className="h-4 w-4" /> Bật voice
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={toggleMute}
              disabled={callState !== 'active'}
            >
              {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              {micOn ? 'Tắt mic' : 'Mở mic'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setEnabled(false)}
            >
              <PhoneOff className="h-4 w-4" /> Dừng
            </Button>
          </>
        )}
      </div>

      {callState === 'connecting' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Đang thiết lập kết nối P2P…
        </div>
      )}
      {callState === 'active' && (
        <p className="text-xs text-emerald-700">● Đã kết nối — bạn có thể nói chuyện.</p>
      )}
      {callState === 'idle' && enabled === false && (
        <p className="text-xs text-muted-foreground">
          Bật voice để trò chuyện trực tiếp với đối thủ (cần cấp quyền micro).
        </p>
      )}
    </div>
  );
}

export default VoicePanel;
