import { useEffect, useState } from 'react'
import type { Loadable } from '../types'

export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ state: 'loading' })
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
