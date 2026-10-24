import { useEffect, useState } from 'react'
import { campusNow } from './recommend'

// Everything on the dashboard is worked out from the current time, but the
// loaders only ran once, so a tab left open at 08:50 still said the 09:00 class
// had not started at 10:30, and after midnight the schedule was yesterday's.
// This gives those loaders something that changes to depend on.
export function useMinuteTick() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  return tick
}

// The campus hour, which changes sixty times less often than the minute does.
//
// Three screens used to pass the minute tick into their loaders, so every one
// of them refetched the same documents once a minute whether or not anything
// had changed. Against Firestore, which charges by the document read, one tab
// left open on the dashboard was 176 reads a minute and would eat a day's free
// quota in under five hours while nobody touched it.
//
// What those three actually depend on is the hour: which occupancy row to
// read, and which events have not started. So they key on this instead, and
// anything that genuinely needs the minute recomputes from rows it already
// has.
export function useCampusHour() {
  useMinuteTick()
  return Math.floor(campusNow().minutes / 60)
}
