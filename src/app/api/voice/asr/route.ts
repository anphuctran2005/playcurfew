/**
 * POST /api/voice/asr
 * Speech-to-text for voice messages (used in bot-mode voice chat).
 * Body: { audio: base64 (without data: prefix) }
 * Returns: { text }
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { audio }: { audio?: string } = await req.json();
    if (!audio || typeof audio !== 'string') {
      return NextResponse.json({ error: 'audio base64 is required' }, { status: 400 });
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const response = await zai.audio.asr.create({
      file_base64: audio,
    });

    const text = (response.text || '').trim();
    return NextResponse.json({ text });
  } catch (err) {
    console.error('[/api/voice/asr] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ASR failed' },
      { status: 500 }
    );
  }
}
