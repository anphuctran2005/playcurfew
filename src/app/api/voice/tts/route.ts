/**
 * POST /api/voice/tts
 * Text-to-speech. Returns audio/wav directly.
 * Body: { text, voice?, speed? }
 * Used to "speak" the bot opponent's chat replies.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const {
      text,
      voice = 'tongtong',
      speed = 1.0,
    }: { text?: string; voice?: string; speed?: number } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const response = await zai.audio.tts.create({
      input: text.slice(0, 1024),
      voice,
      speed: Math.min(2, Math.max(0.5, speed)),
      response_format: 'wav',
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('[/api/voice/tts] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'TTS failed' },
      { status: 500 }
    );
  }
}
