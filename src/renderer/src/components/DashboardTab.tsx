import { CircleCheck, Gamepad2, Lock, type LucideIcon } from 'lucide-react'
import type { DashboardState } from '../../../shared/types'
import { formatDuration, formatTime } from '../lib/format'
import { Card, PageHeader } from './ui'

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
  yellow: 'animate-blink border-amber-400/40 bg-amber-400/15 text-amber-300',
  red: 'border-red-500/40 bg-red-500/15 text-red-300'
}

interface Badge {
  color: keyof typeof BADGE_COLORS
  icon: LucideIcon
  text: string
}

function getRingColor(dashboard: DashboardState, ratio: number): keyof typeof RING_COLORS {
  if (dashboard.isFocusActive || dashboard.remainingSeconds <= 0) return 'red'
  if (ratio >= WARNING_RATIO || dashboard.remainingSeconds < WARNING_SECONDS) return 'yellow'
  return 'green'
}

function getBadge(dashboard: DashboardState): Badge {
  if (dashboard.isFocusActive) {
    return { color: 'red', icon: Lock, text: 'Đang khóa: Giờ tập trung học tập' }
  }
  if (dashboard.remainingSeconds <= 0) {
    return { color: 'red', icon: Lock, text: 'Đã hết hạn ngạch hôm nay' }
  }
  if (dashboard.runningGames.length > 0) {
    const names = dashboard.runningGames.map((game) => game.name).join(', ')
    return { color: 'yellow', icon: Gamepad2, text: `Đang chơi: ${names}` }
  }
  return {
    color: 'green',
    icon: CircleCheck,
    text: 'Đang rảnh rỗi - Sẵn sàng học tập/giải trí'
  }
}

function formatDate(date: string): string {
  // Thêm giờ để được hiểu theo giờ máy: chuỗi chỉ có ngày sẽ bị coi là UTC.
  return new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-col justify-center rounded-xl border border-slate-700 bg-slate-800 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function DashboardTab({ dashboard }: { dashboard: DashboardState }): React.JSX.Element {
  const { date, usedSeconds, limitSeconds, remainingSeconds, isFocusActive, sessions } = dashboard
  const ratio = limitSeconds > 0 ? Math.min(usedSeconds / limitSeconds, 1) : 1
  const badge = getBadge(dashboard)
  const BadgeIcon = badge.icon

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader title="Tổng quan" subtitle={formatDate(date)} />

      <p
        role="status"
        className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${BADGE_COLORS[badge.color]}`}
      >
        <BadgeIcon className="size-4 shrink-0" />
        <span className="min-w-0 truncate">{badge.text}</span>
      </p>

      <div className="grid grid-cols-[auto_1fr] gap-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="relative size-48">
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
              <p className="text-3xl font-semibold tabular-nums">
                {Math.floor(usedSeconds / 60)}
                <span className="text-lg text-slate-400"> / {limitSeconds / 60}</span>
              </p>
              <p className="text-xs text-slate-400">phút hôm nay</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Stat label="Đã chơi" value={formatDuration(usedSeconds)} />
          <Stat label="Còn lại" value={formatDuration(remainingSeconds)} />
          <Stat label="Số phiên chơi" value={String(sessions.length)} />
          <Stat label="Giờ Focus" value={isFocusActive ? 'Đang diễn ra' : 'Không có'} />
        </div>
      </div>

      <Card title="Lịch sử phiên chơi hôm nay">
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
      </Card>
    </div>
  )
}

export default DashboardTab
