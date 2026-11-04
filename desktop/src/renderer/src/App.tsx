import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import type { DashboardState, GameItem } from '../../shared/types'

// Màn hình Debug tạm thời cho Giai đoạn 2, sẽ thay bằng UI chính thức.
function App(): React.JSX.Element {
  const [dashboard, setDashboard] = useState<DashboardState | null>(null)
  const [games, setGames] = useState<GameItem[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.getDashboardState().then(setDashboard)
    window.api.getGames().then(setGames)
    return window.api.onTickUpdate(setDashboard)
  }, [])

  const addNotepad = async (): Promise<void> => {
    try {
      await window.api.addGame({ name: 'Notepad (test)', exeName: 'notepad.exe', isActive: true })
      setGames(await window.api.getGames())
      setError('')
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-slate-950 p-6 text-slate-100">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">GameGuard Debug</h1>
        <button
          type="button"
          onClick={addNotepad}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500"
        >
          <Plus className="size-4" />
          Chặn notepad.exe
        </button>
      </header>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <section>
        <h2 className="mb-1 text-sm text-slate-400">DashboardState (cập nhật mỗi 5 giây)</h2>
        <pre className="overflow-auto rounded-lg bg-slate-900 p-3 text-xs">
          {JSON.stringify(dashboard, null, 2)}
        </pre>
      </section>

      <section>
        <h2 className="mb-1 text-sm text-slate-400">Danh sách game ({games.length})</h2>
        <pre className="overflow-auto rounded-lg bg-slate-900 p-3 text-xs">
          {JSON.stringify(games, null, 2)}
        </pre>
      </section>
    </main>
  )
}

export default App
