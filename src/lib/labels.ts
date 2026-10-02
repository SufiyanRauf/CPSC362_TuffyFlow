import type { SpotKind } from '../types'

// The dashboard and the spots screen were naming these differently, so the same
// place showed as "Food" on one and "eat" on the other.
export const spotKindLabels: Record<SpotKind, string> = {
  study: 'Study spot',
  eat: 'Food',
  meet: 'Meet up',
  charge: 'Charging',
}
