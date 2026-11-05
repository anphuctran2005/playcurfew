import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronRight,
  FolderOpen,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  X
} from 'lucide-react'
import type { DiscoveredApp, GameItem, NewGame } from '../../../shared/types'
import { errorMessage } from '../lib/format'
import { useT } from '../lib/i18n'
import { AppIcon } from './ui'

function hasExe(games: GameItem[], exeName: string): boolean {
  return games.some((game) => game.exeName.toLowerCase() === exeName.toLowerCase())
}

function toNewGame({ name, exeName, iconDataUrl }: DiscoveredApp): NewGame {
  return { name, exeName, iconDataUrl, isActive: true }
}

interface AppPickerModalProps {
  games: GameItem[]
  onAdd: (games: NewGame[]) => Promise<void>
  onClose: () => void
}

function AppPickerModal({ games, onAdd, onClose }: AppPickerModalProps): React.JSX.Element {
  const t = useT()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [apps, setApps] = useState<DiscoveredApp[] | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [manualName, setManualName] = useState('')
  const [manualExe, setManualExe] = useState('')
  const [error, setError] = useState('')

  const loadApps = (): void => {
    window.api
      .scanRunningApps()
      .then(setApps)
      .catch((e) => {
        setApps([])
        setError(errorMessage(e))
      })
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    // showModal đưa focus vào nút đầu tiên, trong khi người dùng thường gõ tìm ngay.
    searchRef.current?.focus()
    loadApps()
  }, [])

  const rescan = (): void => {
    setApps(null)
    loadApps()
  }

  const add = async (newGames: NewGame[]): Promise<void> => {
    try {
      await onAdd(newGames)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const addSingle = (game: NewGame): Promise<void> => {
    if (hasExe(games, game.exeName)) {
      setError(t('gamesDuplicate', { exe: game.exeName }))
      return Promise.resolve()
    }
    return add([game])
  }

  const browse = async (): Promise<void> => {
    try {
      const app = await window.api.browseAppFile()
      if (app) await addSingle(toNewGame(app))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const addManual = (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    return addSingle({ name: manualName.trim(), exeName: manualExe.trim(), isActive: true })
  }

  const toggle = (exeName: string): void => {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(exeName)) next.add(exeName)
      return next
    })
  }

  const search = query.trim().toLowerCase()
  const visibleApps = (apps ?? []).filter(
    (app) => app.name.toLowerCase().includes(search) || app.exeName.toLowerCase().includes(search)
  )
  const selectedApps = (apps ?? []).filter((app) => selected.has(app.exeName))

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-800 p-6 text-slate-100 backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{t('pickerTitle')}</h2>
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={browse} className="btn btn-secondary min-w-0 shrink">
            <FolderOpen className="size-4 shrink-0" />
            <span className="truncate">{t('pickerBrowse')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('unlockClose')}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-100"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('pickerSearch')}
            aria-label={t('pickerSearch')}
            className="field w-full pl-9"
          />
        </div>
        <button
          type="button"
          onClick={rescan}
          disabled={apps === null}
          aria-label={t('pickerRefresh')}
          title={t('pickerRefresh')}
          className="btn btn-secondary"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs text-amber-300">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        {t('gamesScanWarning')}
      </p>

      {error && <p className="page-error mt-3 border border-red-500/40">{error}</p>}

      <div className="mt-3 h-64 overflow-y-auto rounded-lg border border-slate-700 p-2">
        {apps === null ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            <LoaderCircle className="size-6 animate-spin" />
          </div>
        ) : visibleApps.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-400">
            {apps.length === 0 ? t('pickerEmpty') : t('pickerNoMatch')}
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {visibleApps.map((app) => {
              const isAdded = hasExe(games, app.exeName)
              const isSelected = selected.has(app.exeName)
              return (
                <li key={app.exeName}>
                  <button
                    type="button"
                    disabled={isAdded}
                    aria-pressed={isSelected}
                    onClick={() => toggle(app.exeName)}
                    className={`relative flex h-full w-full flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/15'
                        : 'border-slate-700 not-disabled:hover:bg-slate-700'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-sky-600 text-white">
                        <Check className="size-3.5" />
                      </span>
                    )}
                    <AppIcon src={app.iconDataUrl} className="size-12" />
                    <span className="line-clamp-2 w-full text-sm font-medium break-words">
                      {app.name}
                    </span>
                    <span className="w-full truncate text-xs text-slate-400">
                      {isAdded ? t('pickerAdded') : app.exeName}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-slate-400 hover:text-slate-100">
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
          {t('pickerManual')}
        </summary>
        <form onSubmit={addManual} className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder={t('gamesDisplayName')}
            aria-label={t('gamesDisplayName')}
            className="field min-w-0"
          />
          <input
            value={manualExe}
            onChange={(e) => setManualExe(e.target.value)}
            placeholder={t('gamesExePlaceholder')}
            aria-label={t('gamesExeLabel')}
            className="field min-w-0"
          />
          <button
            type="submit"
            disabled={!manualName.trim() || !manualExe.trim()}
            className="btn btn-secondary"
          >
            <Plus className="size-4" />
            {t('gamesAdd')}
          </button>
        </form>
      </details>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn btn-secondary">
          {t('unlockCancel')}
        </button>
        <button
          type="button"
          disabled={selectedApps.length === 0}
          onClick={() => add(selectedApps.map(toNewGame))}
          className="btn btn-primary"
        >
          <Plus className="size-4" />
          {t('pickerAddSelected')}
          {selectedApps.length > 0 && ` (${selectedApps.length})`}
        </button>
      </div>
    </dialog>
  )
}

export default AppPickerModal
