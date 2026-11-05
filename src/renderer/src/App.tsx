import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { getCommitmentPhrase } from '../../shared/i18n'
import type { AppConfig, DashboardState, Language } from '../../shared/types'
import BlacklistTab from './components/BlacklistTab'
import DashboardTab from './components/DashboardTab'
import EmergencyUnlockModal from './components/EmergencyUnlockModal'
import ScheduleTab from './components/ScheduleTab'
import SettingsTab from './components/SettingsTab'
import Sidebar, { type TabId } from './components/Sidebar'
import { LanguageContext } from './lib/i18n'

function App(): React.JSX.Element {
  const [dashboard, setDashboard] = useState<DashboardState | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)

  const refreshDashboard = (): void => {
    window.api.getDashboardState().then(setDashboard)
  }

  useEffect(() => {
    refreshDashboard()
    window.api.getConfig().then(setConfig)
    window.api.getBackgroundImage().then(setBackgroundImage)
    return window.api.onTickUpdate(setDashboard)
  }, [])

  const theme = config?.theme
  const language = config?.language

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
    if (language) document.documentElement.lang = language
  }, [theme, language])

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

  const setLanguage = async (next: Language): Promise<void> => {
    setConfig(await window.api.updateConfig({ language: next }))
  }

  const hasCustomBackground = config.backgroundColor !== null || backgroundImage !== null

  return (
    <LanguageContext value={config.language}>
      <div className="flex h-full">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isLocked={isLocked}
          tempUnlockMsLeft={tempUnlockMsLeft}
          language={config.language}
          onLanguageChange={setLanguage}
          onEmergencyUnlock={() => setIsUnlockModalOpen(true)}
        />

        <main
          data-custom-background={hasCustomBackground ? '' : undefined}
          style={{
            backgroundColor: config.backgroundColor ?? undefined,
            backgroundImage: backgroundImage ? `url("${backgroundImage}")` : undefined
          }}
          className="min-w-0 flex-1 overflow-y-auto bg-cover bg-center p-6"
        >
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
          {activeTab === 'settings' && (
            <SettingsTab
              config={config}
              backgroundImage={backgroundImage}
              onConfigChange={setConfig}
              onBackgroundImageChange={setBackgroundImage}
            />
          )}
        </main>

        {isUnlockModalOpen && (
          <EmergencyUnlockModal
            phrase={getCommitmentPhrase(config)}
            onConfirm={startTempUnlock}
            onClose={() => setIsUnlockModalOpen(false)}
          />
        )}
      </div>
    </LanguageContext>
  )
}

export default App
