import { useEffect, useState } from 'react'

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
