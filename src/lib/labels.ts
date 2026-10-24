import type { SpotKind } from '../types'

// The dashboard and the spots screen were naming these differently, so the same
// place showed as "Food" on one and "eat" on the other.
export const spotKindLabels: Record<SpotKind, string> = {
  study: 'Study spot',
  eat: 'Food',
  meet: 'Meet up',
  charge: 'Charging',
}

// What to call somebody. full_name is whatever signup or Google handed over
// and can be missing, so the email is the next best thing: it is at least
// theirs, and it tells two accounts apart, which "Your account" would not.
export function personName(fullName: string | null, email: string) {
  const named = fullName?.trim()
  if (named) return named
  const local = email.split('@')[0]
  return local || 'Your account'
}
