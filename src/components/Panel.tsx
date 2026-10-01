import type { Loadable } from '../types'

type PanelProps<T> = {
  source: Loadable<T>
  empty?: string
  children: (data: T) => React.ReactNode
}

export default function Panel<T>({ source, empty, children }: PanelProps<T>) {
  if (source.state === 'loading') {
    return <p className="text-sm text-slate-400">Loading...</p>
  }
  if (source.state === 'error') {
    return (
      <div className="rounded-xl bg-slate-800 p-4 text-sm">
        <p className="text-amber-400">Could not load this.</p>
        <p className="mt-1 text-slate-400">{source.message}</p>
      </div>
    )
  }
  if (Array.isArray(source.data) && source.data.length === 0) {
    return <p className="text-sm text-slate-400">{empty ?? 'Nothing to show.'}</p>
  }
  return <>{children(source.data)}</>
}
