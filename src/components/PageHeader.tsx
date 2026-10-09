type PageHeaderProps = {
  title: string
  children: React.ReactNode
}

export default function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-titan">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">{children}</p>
    </div>
  )
}
