import type { DashboardState } from '../../../shared/types'
import { formatDuration, formatTime } from '../lib/format'

const RING_RADIUS = 100
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const WARNING_RATIO = 0.7
const WARNING_SECONDS = 15 * 60

const RING_COLORS = {
  green: 'stroke-emerald-500',
  yellow: 'stroke-amber-400',
  red: 'stroke-red-500'
}

const BADGE_COLORS = {
  green: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  yellow: 'animate-pulse border-amber-400/40 bg-amber-400/15 text-amber-300',
  red: 'border-red-500/40 bg-red-500/15 text-red-300'
}

function getRingColor(dashboard: DashboardState, ratio: number): keyof typeof RING_COLORS {
  if (dashboard.isFocusActive || dashboard.remainingSeconds <= 0) return 'red'
  if (ratio >= WARNING_RATIO || dashboard.remainingSeconds < WARNING_SECONDS) return 'yellow'
  return 'green'
}

function getBadge(dashboard: DashboardState): { color: keyof typeof BADGE_COLORS; text: string } {
  if (dashboard.isFocusActive) return { color: 'red', text: 'Đang khóa: Giờ tập trung học tập' }
  if (dashboard.remainingSeconds <= 0) return { color: 'red', text: 'Đã hết hạn ngạch hôm nay' }
  if (dashboard.runningGames.length > 0) {
    const names = dashboard.runningGames.map((game) => game.name).join(', ')
    return { color: 'yellow', text: `Đang chơi: ${names}` }
  }
  return { color: 'green', text: 'Đang rảnh rỗi - Sẵn sàng học tập/giải trí' }
}

function DashboardTab({ dashboard }: { dashboard: DashboardState }): React.JSX.Element {
  const { usedSeconds, limitSeconds, remainingSeconds, sessions } = dashboard
  const ratio = limitSeconds > 0 ? Math.min(usedSeconds / limitSeconds, 1) : 1
  const badge = getBadge(dashboard)

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
      <div className="relative size-60">
        <svg viewBox="0 0 240 240" className="size-full -rotate-90">
          <circle
            cx="120"
            cy="120"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="16"
            className="stroke-slate-700"
          />
          {ratio > 0 && (
            <circle
              cx="120"
              cy="120"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - ratio)}
              className={`transition-all duration-500 ${RING_COLORS[getRingColor(dashboard, ratio)]}`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-4xl font-semibold tabular-nums">
            {Math.floor(usedSeconds / 60)}
            <span className="text-xl text-slate-400"> / {limitSeconds / 60}</span>
          </p>
          <p className="text-sm text-slate-400">phút hôm nay</p>
          <p className="mt-2 text-sm text-slate-300">Còn {Math.ceil(remainingSeconds / 60)} phút</p>
        </div>
      </div>

      <p
        role="status"
        className={`max-w-full rounded-full border px-4 py-2 text-center text-sm font-medium ${BADGE_COLORS[badge.color]}`}
      >
        {badge.text}
      </p>

      <section className="w-full rounded-xl border border-slate-700 bg-slate-800">
        <h2 className="border-b border-slate-700 px-4 py-3 text-sm font-semibold">
          Lịch sử phiên chơi hôm nay
        </h2>
        {sessions.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">
            Hôm nay chưa có phiên chơi.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Game</th>
                <th className="px-4 py-2 font-medium">Bắt đầu</th>
                <th className="px-4 py-2 font-medium">Thời lượng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {[...sessions].reverse().map((session) => (
                <tr key={session.startTime}>
                  <td className="px-4 py-2">{session.gameName}</td>
                  <td className="px-4 py-2 tabular-nums">{formatTime(session.startTime)}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {formatDuration(session.durationSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default DashboardTab
