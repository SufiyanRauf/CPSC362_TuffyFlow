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

// The same five words api/scoring.py:340 uses when it explains a spot pick on
// the dashboard. A bare "noise 5 of 5" does not tell a student that Panda
// Express is no place to write an essay, and the words were already written,
// they just never reached the screen.
export const noiseWords: Record<number, string> = {
  1: 'silent',
  2: 'quiet',
  3: 'some background noise',
  4: 'lively',
  5: 'loud',
}

export function noiseText(level: number) {
  const word = noiseWords[level]
  return word ? `noise ${level} of 5, ${word}` : `noise ${level} of 5`
}

// Tags are stored as slugs because that is the form the profile is matched
// against, but nobody writes "health-wellness", so the hyphen comes out on the
// way to the screen and nowhere else. Clubs and Events render the same
// vocabulary and were spelling it two different ways.
export function tagText(tag: string) {
  return tag.replace(/-/g, ' ')
}
