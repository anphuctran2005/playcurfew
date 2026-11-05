import { useEffect, useState } from 'react'
import { Lock, Plus, Trash2 } from 'lucide-react'
import type { GameItem, NewGame } from '../../../shared/types'
import { errorMessage } from '../lib/format'
import { useT } from '../lib/i18n'
import AppPickerModal from './AppPickerModal'
import LockNotice from './LockNotice'
import Toggle from './Toggle'
import { AppIcon, Card, PageHeader } from './ui'

function BlacklistTab({ isLocked }: { isLocked: boolean }): React.JSX.Element {
  const t = useT()
  const [games, setGames] = useState<GameItem[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.getGames().then(setGames)
  }, [])

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    try {
      await action()
      setGames(await window.api.getGames())
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const addGames = async (newGames: NewGame[]): Promise<void> => {
    for (const game of newGames) await window.api.addGame(game)
    setGames(await window.api.getGames())
    setError('')
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader title={t('tabGames')} subtitle={t('gamesSubtitle')} />

      {isLocked && <LockNotice>{t('gamesLocked')}</LockNotice>}
      {error && <p className="page-error">{error}</p>}

      <Card
        title={t('gamesListTitle', { count: games.length })}
        action={
          <button type="button" onClick={() => setIsPickerOpen(true)} className="btn btn-primary">
            <Plus className="size-4" />
            {t('pickerTitle')}
          </button>
        }
      >
        {games.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">{t('gamesEmpty')}</p>
        ) : (
          <ul className="divide-y divide-slate-700">
            {games.map((game) => (
              <li key={game.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    game.isActive
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  <AppIcon src={game.iconDataUrl} className="size-7" />
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

      {isPickerOpen && (
        <AppPickerModal games={games} onAdd={addGames} onClose={() => setIsPickerOpen(false)} />
      )}
    </div>
  )
}

export default BlacklistTab
