import { CalendarClock, Gamepad2, LayoutDashboard, Lock, LockOpen } from 'lucide-react'
import logo from '../assets/logo.svg'
import { formatClock } from '../lib/format'

export type TabId = 'dashboard' | 'blacklist' | 'schedule'

const TABS = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'blacklist', label: 'Danh sách game', icon: Gamepad2 },
  { id: 'schedule', label: 'Giới hạn & Focus', icon: CalendarClock }
] as const

interface SidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  isLocked: boolean
  tempUnlockMsLeft: number
  onEmergencyUnlock: () => void
}

function Sidebar({
  activeTab,
  onTabChange,
  isLocked,
  tempUnlockMsLeft,
  onEmergencyUnlock
}: SidebarProps): React.JSX.Element {
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-slate-700 bg-slate-800 p-4">
      <div className="flex items-center gap-3 px-1">
        <img src={logo} alt="" className="size-10" />
        <div>
          <h1 className="text-base leading-tight font-semibold">PlayCurfew</h1>
          <p className="text-xs text-slate-400">Giữ kỷ luật giờ chơi</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      {tempUnlockMsLeft > 0 ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <LockOpen className="size-4" />
            Mở khóa tạm thời
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-200 tabular-nums">
            {formatClock(tempUnlockMsLeft)}
          </p>
        </div>
      ) : isLocked ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-red-300">
            <Lock className="size-4" />
            Cài đặt đang khóa
          </p>
          <button type="button" onClick={onEmergencyUnlock} className="btn btn-danger mt-3 w-full">
            Mở khóa khẩn cấp
          </button>
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-slate-700 p-3 text-sm text-slate-300">
          <LockOpen className="size-4 text-emerald-400" />
          Cài đặt đang mở
        </p>
      )}
    </aside>
  )
}

export default Sidebar
