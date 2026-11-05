import { Gamepad2 } from 'lucide-react'

interface AppIconProps {
  src?: string
  className: string
}

export function AppIcon({ src, className }: AppIconProps): React.JSX.Element {
  return src ? (
    <img src={src} alt="" className={`${className} shrink-0 object-contain`} />
  ) : (
    <Gamepad2 className={`${className} shrink-0 text-slate-400`} />
  )
}

interface PageHeaderProps {
  title: string
  subtitle: string
}

export function PageHeader({ title, subtitle }: PageHeaderProps): React.JSX.Element {
  return (
    <header className="page-header">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>
    </header>
  )
}

interface CardProps {
  title: string
  action?: React.ReactNode
  children?: React.ReactNode
}

export function Card({ title, action, children }: CardProps): React.JSX.Element {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800">
      <div
        className={`flex min-h-12 items-center justify-between gap-4 px-4 py-2 ${
          children ? 'border-b border-slate-700' : ''
        }`}
      >
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}
