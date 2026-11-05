import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { AppConfig, DashboardState } from '../../shared/types'
import BlacklistTab from './components/BlacklistTab'
import DashboardTab from './components/DashboardTab'
import EmergencyUnlockModal from './components/EmergencyUnlockModal'
import ScheduleTab from './components/ScheduleTab'
import Sidebar, { type TabId } from './components/Sidebar'

function App(): React.JSX.Element {
  const [dashboard, setDashboard] = useState<DashboardState | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const refreshDashboard = (): void => {
    window.api.getDashboardState().then(setDashboard)
  }

  useEffect(() => {
    refreshDashboard()
    window.api.getConfig().then(setConfig)
    return window.api.onTickUpdate(setDashboard)
  }, [])

  const tempUnlockedUntil = dashboard?.tempUnlockedUntil ?? null

  useEffect(() => {
    if (tempUnlockedUntil === null) return

    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      // Không chờ lượt 5 giây tiếp theo: khóa lại ngay khi hết giờ.
      if (current > tempUnlockedUntil) refreshDashboard()
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
  const { isLocked } = dashboard

  const startTempUnlock = async (input: string): Promise<boolean> => {
    const state = await window.api.verifyEmergencyUnlock(input)
    setDashboard(state)
    setNow(Date.now())

    const isUnlocked = state.tempUnlockedUntil !== null
    if (isUnlocked) setIsUnlockModalOpen(false)
    return isUnlocked
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
