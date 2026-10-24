// One counter meaning "the rows behind the screen have changed, load them
// again". Anything scored against the profile or the schedule passes it into
// its useAsync deps.
//
// It used to live in campusData.ts. It is its own module now because signing
// in changes where every row comes from, so the session has to be able to ring
// this bell too, and campusData already reads the session. Neither of them can
// import the other.
let version = 0
const listeners = new Set<() => void>()

export function subscribeToData(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function dataVersion() {
  return version
}

export function dataChanged() {
  version += 1
  for (const listener of listeners) listener()
}
