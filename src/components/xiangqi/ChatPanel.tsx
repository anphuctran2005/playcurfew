'use client';

/**
 * ChatPanel — text chat for both bot & multiplayer modes.
 * In bot mode, also offers a "voice message" button (record → ASR → text → send).
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';

export interface ChatMsg {
  id: string;
  from: string;
  color: 'red' | 'black' | 'system';
  text: string;
  ts: number;
}

interface ChatPanelProps {
  messages: ChatMsg[];
  onSend: (text: string) => void;
  /** Show the record-a-voice-message button (bot mode). */
  enableVoiceMessage?: boolean;
  disabled?: boolean;
  myColor: 'red' | 'black';
}

export function ChatPanel({
  messages,
  onSend,
  enableVoiceMessage = false,
  disabled = false,
  myColor,
}: ChatPanelProps) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // auto-scroll to bottom
    const el = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          setTranscribing(true);
          try {
            const res = await fetch('/api/voice/asr', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64 }),
            });
            const data = await res.json();
            const t = (data.text || '').trim();
            if (t) onSend(t);
          } catch (e) {
            console.error('ASR failed', e);
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch (e) {
      console.error('mic error', e);
      alert('Không truy cập được micro.');
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    setRecording(false);
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea ref={scrollRef} className="flex-1 rounded-md border border-amber-200 bg-amber-50/40">
        <div className="space-y-2 p-3">
          {messages.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có tin nhắn. Hãy gửi lời chào đối thủ!
            </p>
          )}
          {messages.map((m) => {
            const mine = m.color === myColor;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
              >
                {m.color !== 'system' && (
                  <span
                    className={`mb-0.5 text-[11px] font-medium ${
                      m.color === 'red' ? 'text-red-700' : m.color === 'black' ? 'text-stone-700' : 'text-muted-foreground'
                    }`}
                  >
                    {m.from}
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${
                    m.color === 'system'
                      ? 'mx-auto bg-muted text-muted-foreground italic text-center'
                      : mine
                        ? 'bg-red-700 text-white'
                        : m.color === 'red'
                          ? 'bg-red-100 text-red-900'
                          : 'bg-stone-200 text-stone-900'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })}
          {transcribing && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Đang chuyển giọng nói thành văn bản…
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="mt-2 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Nhập tin nhắn…"
          disabled={disabled}
          className="border-amber-200"
        />
        {enableVoiceMessage && (
          <Button
            type="button"
            size="icon"
            variant={recording ? 'destructive' : 'outline'}
            onClick={recording ? stopRecording : startRecording}
            disabled={disabled || transcribing}
            title={recording ? 'Dừng ghi' : 'Gửi tin nhắn thoại'}
          >
            {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <Button type="button" size="icon" onClick={send} disabled={disabled || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {recording && (
        <p className="mt-1 text-center text-xs text-red-600">
          ● Đang ghi… bấm nút mic để dừng và gửi.
        </p>
      )}
    </div>
  );
}

export default ChatPanel;
