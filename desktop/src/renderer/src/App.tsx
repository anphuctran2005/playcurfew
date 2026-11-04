import { Monitor, Send } from 'lucide-react'
import Versions from './components/Versions'

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 text-slate-100 select-none">
      <Monitor className="size-16 text-sky-400" />
      <h1 className="text-2xl font-semibold">Electron + React + TypeScript</h1>
      <p className="text-sm text-slate-400">
        Press <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono">F12</kbd> to open
        DevTools
      </p>
      <button
        type="button"
        onClick={ipcHandle}
        className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
      >
        <Send className="size-4" />
        Send IPC
      </button>
      <Versions />
    </main>
  )
}

export default App
