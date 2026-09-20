// Shapes for the hardcoded data. These get replaced with the real database row
// types in week 2, but the fields should stay the same so nothing else changes.

export type Student = {
  name: string
  major: string
}

export type NextClass = {
  courseCode: string
  startsAt: string      // display string for now, a real time later
  building: string
  minutesUntil: number | null   // null when there is no class coming up
}

export type RecKind = 'parking' | 'spot' | 'event'

export type Recommendation = {
  id: string
  kind: RecKind
  title: string
  matchPercent: number
  reason: string
}
