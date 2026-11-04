interface PageHeaderProps {
  title: string
  subtitle: string
}

export function PageHeader({ title, subtitle }: PageHeaderProps): React.JSX.Element {
  return (
    <header>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>
    </header>
  )
}

interface CardProps {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}

export function Card({ title, action, children }: CardProps): React.JSX.Element {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800">
      <div className="flex min-h-12 items-center justify-between gap-4 border-b border-slate-700 px-4 py-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}
