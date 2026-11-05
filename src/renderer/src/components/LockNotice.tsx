import { Lock } from 'lucide-react'
import { useT } from '../lib/i18n'

function LockNotice({ children }: { children: React.ReactNode }): React.JSX.Element {
  const t = useT()

  return (
    <p className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-slate-800 px-3 py-2 text-sm text-red-200">
      <Lock className="mt-0.5 size-4 shrink-0" />
      <span>
        {children} {t('lockHint')}
      </span>
    </p>
  )
}

export default LockNotice
