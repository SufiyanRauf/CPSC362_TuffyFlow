import { useSyncExternalStore } from 'react'
import { dataVersion, subscribeToData } from './campusData'

// Anything scored against the profile or the schedule has to reload when those
// change, so it passes this into its useAsync deps.
export function useDataVersion() {
  return useSyncExternalStore(subscribeToData, dataVersion, dataVersion)
}
