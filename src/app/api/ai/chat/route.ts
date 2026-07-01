/**
 * POST /api/ai/chat
 * LLM-powered Xiangqi opponent chat. Returns a short Vietnamese reply.
 * Used in bot-mode chat so the opponent can "talk" with the player.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `Bạn là một đối thủ cờ tướng thân thiện và hơi khiêu khích. Bạn đang chơi cờ với người dùng.
Phong cách: ngắn gọn, tự tin, đôi khi trêu chọc nhẹ nhàng, dùng tiếng Việt.
Luôn trả lời dưới 60 từ. KHÔNG giải thích luật, KHÔNG xin lỗi dài dòng. Có thể bình luận về nước đi, khen/trêu đối thủ.
Đôi khi (khi hợp lý) bạn có thể đề nghị hòa hoặc tuyên bố sẽ thắng.`;

export async function POST(req: NextRequest) {
  try {
    const { message, mood }: { message?: string; mood?: string } = await req.json();
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const userContent = mood ? `${message}\n\n(bối trận: ${mood})` : message;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent.slice(0, 800) },
      ],
      thinking: { type: 'disabled' },
    });

    const reply = completion.choices[0]?.message?.content?.trim() || '...';
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[/api/ai/chat] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'LLM failed' },
      { status: 500 }
    );
  }
}
