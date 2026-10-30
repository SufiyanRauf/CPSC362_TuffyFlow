import { useEffect } from 'react'
import type { Loadable } from '../types'
import { studentFacing } from '../lib/firestoreData'

type PanelProps<T> = {
  source: Loadable<T>
  empty?: string
  children: (data: T) => React.ReactNode
}

// A retry button would be a new control and this is not the place for one, but
// a failed panel was a dead end with nothing on it to press, which reads as
// the app being broken for good. It is not: both caches drop a rejected
// promise, campusData.ts where it holds a read and recommend.ts where it holds
// a score, so leaving the screen and coming back genuinely asks again. No
// student is going to work that out, so this says it.
const RETRY = 'Opening another screen and coming back will ask again, or you can reload the page.'

export default function Panel<T>({ source, empty, children }: PanelProps<T>) {
  const failure = source.state === 'error' ? source.message : null
  // The allowlist this used to hold now lives in firestoreData.ts, next to the
  // sentences it is deciding about, because the Profile screen's saves print
  // what they caught too and were not running any of this.
  const shown = failure === null ? null : studentFacing(failure)
  const generic = failure !== null && shown !== failure

  // The generic line throws away the one detail that says which half of the
  // app is down, which is the detail you want while building, so it goes to
  // the console on the way past.
  //
  // In an effect rather than in the render body below, where it was. A failed
  // panel re-renders every time anything around it does, a filter moving or
  // another panel finishing, and each of those printed the same warning again.
  // Keyed on the message, so it is one line per failure and a second line
  // means the failure actually changed.
  useEffect(() => {
    if (generic) console.warn('Panel could not load:', failure)
  }, [failure, generic])

  const emptied = source.state === 'ready'
    && Array.isArray(source.data) && source.data.length === 0
  const emptyLine = empty ?? 'Nothing to show.'

  // One region, mounted for as long as the panel is, whose text changes. Three
  // of these go up on a first dashboard load, five on a wide screen, and the
  // old shape put the words inside a region as it created it, which is the
  // case App.tsx is careful about. So a reader heard "Loading…" three times
  // and then nothing at all, because each loading region was taken off the
  // page and no region was left to change. A failure was worse: that region
  // went too and a brand new one appeared holding the only failure message in
  // the app, which is a coin flip on whether it is ever read out.
  //
  // Empty is in here as well. It had no live region of any kind, so a refetch
  // that comes back with nothing left a reader on the last thing they heard.
  const announced = source.state === 'loading'
    ? 'Loading…'
    : failure !== null
      ? `Could not load this. ${shown} ${RETRY}`
      : emptied ? emptyLine : ''

  // Both visible designs are unchanged. What changed is that neither of them
  // carries the live region any more, so nothing is announced twice.
  const live = <p role="status" className="sr-only">{announced}</p>

  if (source.state === 'loading') {
    return (
      <>
        {live}
        <p aria-hidden="true" className="py-6 text-sm text-ink-faint">Loading…</p>
      </>
    )
  }
  if (source.state === 'error') {
    return (
      <>
        {live}
        <div
          className="rounded-lg border border-l-4 border-rule border-l-flame-ink
                     bg-white px-4 py-3 text-sm"
        >
          <p className="font-medium text-flame-ink">Could not load this.</p>
          <p className="mt-1 text-ink-soft">{shown}</p>
          <p className="mt-1 text-ink-soft">{RETRY}</p>
        </div>
      </>
    )
  }
  if (emptied) {
    return (
      <>
        {live}
        <p className="py-6 text-sm text-ink-faint">{emptyLine}</p>
      </>
    )
  }
  return (
    <>
      {live}
      {children(source.data)}
    </>
  )
}
