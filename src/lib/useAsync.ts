import { useEffect, useState } from 'react'
import type { Loadable } from '../types'

export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    // only blank the panel on a first load. Back when the dashboard refetched
    // every minute, resetting here made the rail collapse to "Loading…" and
    // spring back each time. The dashboard's class loader does run on the
    // minute again, so that this is here is exactly why the hero does not
    // flash once a minute, and a refetch also happens whenever the rows
    // change, where the flicker would be the same.
    setState((current) => (current.state === 'ready' ? current : { state: 'loading' }))
    load()
      .then((data) => {
        if (!cancelled) setState({ state: 'ready', data })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        // Same rule as the line above, which took me a second failure to
        // notice. The loading reset leaves content alone on a refetch, but
        // this was still happy to throw it away: one dropped request on
        // campus wifi and the hero and the whole recommendation row the
        // student was reading turned into "Could not load this.", with
        // nothing on screen to press, without them touching anything. So an
        // error only reaches the screen on a first load, where there is
        // nothing to lose. A refetch that fails keeps the rows that are
        // already there and says so in the console. Nothing is swallowed
        // either way: every write reports its own failure where it happens.
        setState((current) => {
          if (current.state === 'ready') {
            console.warn('Refetch failed, keeping what is already on screen:', message)
            return current
          }
          return { state: 'error', message }
        })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
