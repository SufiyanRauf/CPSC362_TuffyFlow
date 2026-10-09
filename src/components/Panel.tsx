import type { Loadable } from '../types'

type PanelProps<T> = {
  source: Loadable<T>
  empty?: string
  children: (data: T) => React.ReactNode
}

export default function Panel<T>({ source, empty, children }: PanelProps<T>) {
  if (source.state === 'loading') {
    return <p className="py-6 text-sm text-ink-faint">Loading…</p>
  }
  if (source.state === 'error') {
    return (
      <div className="rounded-lg border border-l-4 border-rule border-l-flame-ink bg-white px-4 py-3 text-sm">
        <p className="font-medium text-flame-ink">Could not load this.</p>
        <p className="mt-1 text-ink-soft">{source.message}</p>
      </div>
    )
  }
  if (Array.isArray(source.data) && source.data.length === 0) {
    return <p className="py-6 text-sm text-ink-faint">{empty ?? 'Nothing to show.'}</p>
  }
  return <>{children(source.data)}</>
}
