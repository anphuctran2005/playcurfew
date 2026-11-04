import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { AppConfig, DashboardState } from '../../shared/types'
import BlacklistTab from './components/BlacklistTab'
import DashboardTab from './components/DashboardTab'
import EmergencyUnlockModal from './components/EmergencyUnlockModal'
import ScheduleTab from './components/ScheduleTab'
import Sidebar, { type TabId } from './components/Sidebar'

const TEMP_UNLOCK_MS = 5 * 60 * 1000

function App(): React.JSX.Element {
  const [dashboard, setDashboard] = useState<DashboardState | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false)
  const [tempUnlockedUntil, setTempUnlockedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const refreshDashboard = (): void => {
    window.api.getDashboardState().then(setDashboard)
  }

  useEffect(() => {
    refreshDashboard()
    window.api.getConfig().then(setConfig)
    return window.api.onTickUpdate(setDashboard)
  }, [])

  useEffect(() => {
    if (tempUnlockedUntil === null) return

    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= tempUnlockedUntil) setTempUnlockedUntil(null)
    }, 1000)
    return () => clearInterval(timer)
  }, [tempUnlockedUntil])

  if (!dashboard || !config) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <LoaderCircle className="size-6 animate-spin" />
      </div>
    )
  }

  const tempUnlockMsLeft = tempUnlockedUntil === null ? 0 : Math.max(tempUnlockedUntil - now, 0)
  const isRestricted =
    dashboard.isFocusActive || dashboard.remainingSeconds <= 0 || dashboard.runningGames.length > 0
  const isLocked = isRestricted && tempUnlockMsLeft === 0

  const startTempUnlock = (): void => {
    const current = Date.now()
    setNow(current)
    setTempUnlockedUntil(current + TEMP_UNLOCK_MS)
    setIsUnlockModalOpen(false)
  }

  return (
    <div className="flex h-full">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isLocked={isLocked}
        tempUnlockMsLeft={tempUnlockMsLeft}
        onEmergencyUnlock={() => setIsUnlockModalOpen(true)}
      />

      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        {activeTab === 'dashboard' && <DashboardTab dashboard={dashboard} />}
        {activeTab === 'blacklist' && <BlacklistTab isLocked={isLocked} />}
        {activeTab === 'schedule' && (
          <ScheduleTab
            config={config}
            isLocked={isLocked}
            onConfigChange={setConfig}
            onChanged={refreshDashboard}
          />
        )}
      </main>

      {isUnlockModalOpen && (
        <EmergencyUnlockModal
          phrase={config.commitmentPhrase}
          onConfirm={startTempUnlock}
          onClose={() => setIsUnlockModalOpen(false)}
        />
      )}
    </div>
  )
}

export default App
