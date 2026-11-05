import { useEffect, useState } from 'react'
import { Gamepad2, LoaderCircle, Lock, Plus, ScanSearch, Trash2, TriangleAlert } from 'lucide-react'
import type { GameItem, RunningProcess } from '../../../shared/types'
import { errorMessage } from '../lib/format'
import { useT } from '../lib/i18n'
import LockNotice from './LockNotice'
import Toggle from './Toggle'
import { Card, PageHeader } from './ui'

function hasExe(games: GameItem[], exeName: string): boolean {
  return games.some((game) => game.exeName.toLowerCase() === exeName.toLowerCase())
}

/** Chỉ giữ tiến trình có cửa sổ, mỗi file exe một dòng. */
function toWindowList(processes: RunningProcess[]): RunningProcess[] {
  const windows = processes.filter((process) => process.windowTitle)
  const byExe = new Map(windows.map((process) => [process.exeName.toLowerCase(), process]))
  return [...byExe.values()].sort((a, b) => a.exeName.localeCompare(b.exeName))
}

function BlacklistTab({ isLocked }: { isLocked: boolean }): React.JSX.Element {
  const t = useT()
  const [games, setGames] = useState<GameItem[]>([])
  const [name, setName] = useState('')
  const [exeName, setExeName] = useState('')
  const [windows, setWindows] = useState<RunningProcess[] | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.getGames().then(setGames)
  }, [])

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    try {
      await action()
      setGames(await window.api.getGames())
      setError('')
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  const addGame = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    const exe = exeName.trim()
    if (hasExe(games, exe)) {
      setError(t('gamesDuplicate', { exe }))
      return
    }

    const isAdded = await run(() =>
      window.api.addGame({ name: name.trim(), exeName: exe, isActive: true })
    )
    if (isAdded) {
      setName('')
      setExeName('')
    }
  }

  const scanWindows = async (): Promise<void> => {
    setIsScanning(true)
    try {
      setWindows(toWindowList(await window.api.getRunningProcesses()))
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setIsScanning(false)
    }
  }

  const pickWindow = (process: RunningProcess): void => {
    setName(process.windowTitle)
    setExeName(process.exeName)
    setWindows(null)
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader title={t('tabGames')} subtitle={t('gamesSubtitle')} />

      {isLocked && <LockNotice>{t('gamesLocked')}</LockNotice>}
      {error && <p className="page-error">{error}</p>}

      <Card
        title={t('gamesAddTitle')}
        action={
          <button
            type="button"
            onClick={scanWindows}
            disabled={isScanning}
            className="btn btn-secondary"
          >
            {isScanning ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ScanSearch className="size-4" />
            )}
            {t('gamesScan')}
          </button>
        }
      >
        <div className="flex flex-col gap-3 p-4">
          <form onSubmit={addGame} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('gamesDisplayName')}
              aria-label={t('gamesDisplayName')}
              className="field min-w-0"
            />
            <input
              value={exeName}
              onChange={(e) => setExeName(e.target.value)}
              placeholder={t('gamesExePlaceholder')}
              aria-label={t('gamesExeLabel')}
              className="field min-w-0"
            />
            <button
              type="submit"
              disabled={!name.trim() || !exeName.trim()}
              className="btn btn-primary"
            >
              <Plus className="size-4" />
              {t('gamesAdd')}
            </button>
          </form>

          {windows && (
            <div className="flex flex-col gap-2">
              <p className="flex items-start gap-2 text-xs text-amber-300">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {t('gamesScanWarning')}
              </p>
              {windows.length === 0 ? (
                <p className="text-sm text-slate-400">{t('gamesNoWindows')}</p>
              ) : (
                <ul className="max-h-52 divide-y divide-slate-700 overflow-y-auto rounded-lg border border-slate-700">
                  {windows.map((process) => {
                    const isAdded = hasExe(games, process.exeName)
                    return (
                      <li key={process.exeName}>
                        <button
                          type="button"
                          disabled={isAdded}
                          onClick={() => pickWindow(process)}
                          className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm not-disabled:hover:bg-slate-700 disabled:opacity-50"
                        >
                          <span className="min-w-0 truncate">{process.windowTitle}</span>
                          <span className="shrink-0 text-xs text-slate-400">
                            {isAdded ? t('gamesAlreadyAdded') : process.exeName}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card title={t('gamesListTitle', { count: games.length })}>
        {games.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">{t('gamesEmpty')}</p>
        ) : (
          <ul className="divide-y divide-slate-700">
            {games.map((game) => (
              <li key={game.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    game.isActive
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  <Gamepad2 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{game.name}</p>
                  <p className="truncate text-xs text-slate-400">{game.exeName}</p>
                </div>
                <Toggle
                  checked={game.isActive}
                  label={t('gamesTrack', { name: game.name })}
                  isLocked={isLocked}
                  onChange={(isActive) => run(() => window.api.updateGame(game.id, { isActive }))}
                />
                <button
                  type="button"
                  disabled={isLocked}
                  aria-label={t('deleteItem', { name: game.name })}
                  title={isLocked ? t('deleteLockedTitle') : undefined}
                  onClick={() => run(() => window.api.removeGame(game.id))}
                  className="btn-delete"
                >
                  {isLocked ? <Lock className="size-4" /> : <Trash2 className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export default BlacklistTab
