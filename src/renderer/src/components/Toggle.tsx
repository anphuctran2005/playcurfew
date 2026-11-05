import { Lock } from 'lucide-react'
import { useT } from '../lib/i18n'

interface ToggleProps {
  checked: boolean
  label: string
  isLocked: boolean
  lockBothWays?: boolean
  onChange: (checked: boolean) => void
}

/** `isLocked` chỉ chặn chiều tắt, trừ khi có `lockBothWays`. */
function Toggle({
  checked,
  label,
  isLocked,
  lockBothWays = false,
  onChange
}: ToggleProps): React.JSX.Element {
  const t = useT()
  const isDisabled = isLocked && (checked || lockBothWays)

  return (
    <span className="flex items-center gap-2">
      {isDisabled && <Lock className="size-4 text-slate-400" />}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        title={isDisabled ? t('toggleLockedTitle') : undefined}
        disabled={isDisabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? 'bg-emerald-600' : 'bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-1 left-1 size-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </span>
  )
}

export default Toggle
