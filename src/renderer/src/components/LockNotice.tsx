import { Lock } from 'lucide-react'

function LockNotice({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
      <Lock className="mt-0.5 size-4 shrink-0" />
      <span>
        {children} Bấm &quot;Mở khóa khẩn cấp&quot; ở thanh bên để mở tạm thời trong 5 phút.
      </span>
    </p>
  )
}

export default LockNotice
