'use client';

/**
 * HomeScreen — landing page with mode selection.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Users, Crown } from 'lucide-react';
import { DIFFICULTIES } from './pieces';

interface HomeScreenProps {
  onSelectBot: () => void;
  onSelectMultiplayer: () => void;
}

export function HomeScreen({ onSelectBot, onSelectMultiplayer }: HomeScreenProps) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      {/* Hero */}
      <div className="mb-8 text-center sm:mb-12">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-800">
          <Crown className="h-4 w-4" /> Cờ Tướng · Xiangqi
        </div>
        <h1 className="bg-gradient-to-b from-red-800 to-red-950 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-6xl">
          Bàn Cờ Tướng
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          Chơi theo đúng luật cờ tướng truyền thống. Đối đầu với Bot ở nhiều cấp độ,
          hoặc thách đấu bạn bè qua mã phòng — kèm nhắn tin và voice chat thời gian thực.
        </p>
      </div>

      {/* Mode cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card
          className="group cursor-pointer border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white transition-all hover:-translate-y-1 hover:border-red-300 hover:shadow-xl"
          onClick={onSelectBot}
        >
          <CardHeader>
            <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-700 transition-transform group-hover:scale-110">
              <Bot className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl text-red-900">Chơi với Bot</CardTitle>
            <CardDescription>
              Luyện tập với máy ở 4 cấp độ từ Dễ đến Cao thủ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <span
                  key={d.value}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-700 ring-1 ring-amber-200"
                >
                  <span>{d.icon}</span>
                  {d.label}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Bot có thể chat và trò chuyện giọng nói với bạn.
            </p>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer border-2 border-amber-200 bg-gradient-to-br from-stone-50 to-white transition-all hover:-translate-y-1 hover:border-stone-400 hover:shadow-xl"
          onClick={onSelectMultiplayer}
        >
          <CardHeader>
            <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-200 text-stone-800 transition-transform group-hover:scale-110">
              <Users className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl text-stone-900">Đấu với bạn bè</CardTitle>
            <CardDescription>
              Tạo phòng hoặc tham gia bằng mã phòng &amp; mật khẩu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>• Tạo phòng riêng tư, chia sẻ mã + mật khẩu cho bạn bè.</li>
              <li>• Nhắn tin và voice chat thời gian thực (WebRTC).</li>
              <li>• Đỏ đi trước — bạn chọn màu khi tạo phòng.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Rules summary */}
      <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold text-amber-900">Tóm tắt luật</h2>
        <div className="grid gap-3 text-sm text-stone-700 sm:grid-cols-2 lg:grid-cols-3">
          <p>♟️ Bàn 9×10, có Sông chia đôi và Cung 3×3 cho Tướng &amp; Sĩ.</p>
          <p>🔴 Đỏ đi trước. Mỗi bên 16 quân: Tướng, Sĩ, Tượng, Mã, Xe, Pháo, Tốt.</p>
          <p>♚ Tướng đi 1 ô ngang/dọc, trong Cung. Sĩ đi chéo trong Cung.</p>
          <p>🐘 Tượng đi chéo 2 ô, không qua Sông, cấm mắt tượng.</p>
          <p>♞ Mã đi chữ L, cấm chân mã. Xe đi ngang/dọc không giới hạn.</p>
          <p>💣 Pháo đi như Xe; khi ăn phải có đúng 1 quân làm bệ.</p>
          <p>♙ Tốt tiến 1 ô; qua Sông được đi ngang, không lùi.</p>
          <p>⚔️ Hai Tướng không đối mặt trên cùng cột không chắn.</p>
          <p>🏁 Thắng khi chiếu bí, hết nước đi, hoặc đối thủ đầu hàng.</p>
        </div>
      </div>
    </div>
  );
}

export default HomeScreen;
