import { useEffect, useState } from 'react'
import type { Loadable } from '../types'

export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    // only blank the panel on a first load. The dashboard refetches every
    // minute, and resetting here made the rail collapse to "Loading…" and
    // spring back each time.
    setState((current) => (current.state === 'ready' ? current : { state: 'loading' }))
    load()
      .then((data) => {
        if (!cancelled) setState({ state: 'ready', data })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({ state: 'error', message: e instanceof Error ? e.message : String(e) })
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
