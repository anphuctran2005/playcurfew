import { CalendarClock, Gamepad2, LayoutDashboard, Lock, LockOpen, Settings } from 'lucide-react'
import type { Language } from '../../../shared/types'
import logo from '../assets/logo.svg'
import { formatClock } from '../lib/format'
import { useT } from '../lib/i18n'

export type TabId = 'dashboard' | 'blacklist' | 'schedule' | 'settings'

const TABS = [
  { id: 'dashboard', labelKey: 'tabDashboard', icon: LayoutDashboard },
  { id: 'blacklist', labelKey: 'tabGames', icon: Gamepad2 },
  { id: 'schedule', labelKey: 'tabSchedule', icon: CalendarClock },
  { id: 'settings', labelKey: 'tabSettings', icon: Settings }
] as const

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'vi', label: 'VI' },
  { value: 'en', label: 'EN' }
]

interface SidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  isLocked: boolean
  tempUnlockMsLeft: number
  language: Language
  onLanguageChange: (language: Language) => void
  onEmergencyUnlock: () => void
}

function Sidebar({
  activeTab,
  onTabChange,
  isLocked,
  tempUnlockMsLeft,
  language,
  onLanguageChange,
  onEmergencyUnlock
}: SidebarProps): React.JSX.Element {
  const t = useT()

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-slate-700 bg-slate-800 p-4">
      <div className="flex items-center gap-3 px-1">
        <img src={logo} alt="" className="size-10" />
        <div>
          <h1 className="text-base leading-tight font-semibold">PlayCurfew</h1>
          <p className="text-xs text-slate-400">{t('tagline')}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {TABS.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
            }`}
          >
            <Icon className="size-4" />
            {t(labelKey)}
          </button>
        ))}
      </nav>

      <div
        role="group"
        aria-label={t('languageLabel')}
        className="flex items-center justify-between gap-2 px-1"
      >
        <span className="text-xs text-slate-400">{t('languageLabel')}</span>
        <div className="flex rounded-lg bg-slate-900 p-0.5">
          {LANGUAGES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={language === value}
              onClick={() => onLanguageChange(value)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                language === value ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tempUnlockMsLeft > 0 ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <LockOpen className="size-4" />
            {t('tempUnlock')}
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-200 tabular-nums">
            {formatClock(tempUnlockMsLeft)}
          </p>
        </div>
      ) : isLocked ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-red-300">
            <Lock className="size-4" />
            {t('settingsLocked')}
          </p>
          <button type="button" onClick={onEmergencyUnlock} className="btn btn-danger mt-3 w-full">
            {t('emergencyUnlock')}
          </button>
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-slate-700 p-3 text-sm text-slate-300">
          <LockOpen className="size-4 text-emerald-400" />
          {t('settingsOpen')}
        </p>
      )}
    </aside>
  )
}

export default Sidebar
