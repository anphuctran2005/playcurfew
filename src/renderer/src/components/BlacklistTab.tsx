import { useEffect, useState } from 'react'
import { LoaderCircle, Lock, Plus, ScanSearch, Trash2, TriangleAlert } from 'lucide-react'
import type { GameItem, RunningProcess } from '../../../shared/types'
import { errorMessage } from '../lib/format'
import LockNotice from './LockNotice'
import Toggle from './Toggle'

const INPUT_CLASS =
  'min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-sky-500 focus:outline-none'

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
      setError(`${exe} đã có trong danh sách.`)
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
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 className="text-xl font-semibold">Danh sách game</h2>

      {isLocked && <LockNotice>Không thể tắt theo dõi hoặc xóa game lúc này.</LockNotice>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-sm font-semibold">Thêm game</h3>
        <form onSubmit={addGame} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên hiển thị"
            aria-label="Tên hiển thị"
            className={INPUT_CLASS}
          />
          <input
            value={exeName}
            onChange={(e) => setExeName(e.target.value)}
            placeholder="ten-game.exe"
            aria-label="Tên file exe"
            className={INPUT_CLASS}
          />
          <button
            type="submit"
            disabled={!name.trim() || !exeName.trim()}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            <Plus className="size-4" />
            Thêm
          </button>
        </form>

        <div>
          <button
            type="button"
            onClick={scanWindows}
            disabled={isScanning}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-50"
          >
            {isScanning ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ScanSearch className="size-4" />
            )}
            Quét ứng dụng đang mở
          </button>
        </div>

        {windows && (
          <div className="flex flex-col gap-2">
            <p className="flex items-start gap-2 text-xs text-amber-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Ứng dụng được thêm sẽ bị buộc tắt khi đang trong giờ Focus hoặc hết giờ chơi, dữ liệu
              chưa lưu sẽ mất.
            </p>
            {windows.length === 0 ? (
              <p className="text-sm text-slate-400">Không tìm thấy cửa sổ nào đang mở.</p>
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
                        className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <span className="min-w-0 truncate">{process.windowTitle}</span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {isAdded ? 'Đã có' : process.exeName}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800">
        <h3 className="border-b border-slate-700 px-4 py-3 text-sm font-semibold">
          Game đang kiểm soát ({games.length})
        </h3>
        {games.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Chưa có game nào.</p>
        ) : (
          <ul className="divide-y divide-slate-700">
            {games.map((game) => (
              <li key={game.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{game.name}</p>
                  <p className="truncate text-xs text-slate-400">{game.exeName}</p>
                </div>
                <Toggle
                  checked={game.isActive}
                  label={`Theo dõi ${game.name}`}
                  isLocked={isLocked}
                  onChange={(isActive) => run(() => window.api.updateGame(game.id, { isActive }))}
                />
                <button
                  type="button"
                  disabled={isLocked}
                  aria-label={`Xóa ${game.name}`}
                  title={isLocked ? 'Đang khóa: dùng "Mở khóa khẩn cấp" để xóa' : undefined}
                  onClick={() => run(() => window.api.removeGame(game.id))}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  {isLocked ? <Lock className="size-4" /> : <Trash2 className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default BlacklistTab
