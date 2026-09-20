// Hardcoded sample data so the dashboard can be built before the database exists.
// Week 2 swaps this out for real Supabase queries. The values here match the seed
// data in db/seed.sql so the screen should not change when we make the switch.

import type { Student, NextClass, Recommendation } from './types'

export const student: Student = {
  name: 'Titan',
  major: 'Computer Science',
}

export const nextClass: NextClass = {
  courseCode: 'CPSC 362',
  startsAt: '11:30 AM',
  building: 'Computer Science',
  minutesUntil: 42,
}

export const recommendations: Recommendation[] = [
  {
    id: 'lot-eastside',
    kind: 'parking',
    title: 'Eastside Parking Structure',
    matchPercent: 88,
    reason: '8 min walk, usually about 30% open at 10 AM',
  },
  {
    id: 'spot-ecs',
    kind: 'spot',
    title: 'ECS Study Area',
    matchPercent: 94,
    reason: 'Quiet, has outlets, 4 min from your next class',
  },
  {
    id: 'event-acm',
    kind: 'event',
    title: 'ACM Resume Workshop',
    matchPercent: 92,
    reason: 'Matches software engineering and career development',
  },
]
