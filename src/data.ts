// sample data until Supabase is wired up in week 2

import type { Student, NextClass, Recommendation } from './types'

export const student: Student = {
  full_name: 'Titan',
  major: 'Computer Science',
}

export const nextClass: NextClass = {
  course_code: 'CPSC 362',
  start_time: '11:30 AM',
  building_name: 'Computer Science',
  minutes_until: 42,
}

export const recommendations: Recommendation[] = [
  {
    id: 'lot-eastside',
    category: 'parking',
    title: 'Eastside North',
    match_percent: 88,
    reason: '4 min walk, usually about 20% open at 10 AM',
  },
  {
    id: 'spot-ecs',
    category: 'spot',
    title: 'ECS Study Area',
    match_percent: 94,
    reason: 'Quiet, has outlets, same building as your next class',
  },
  {
    id: 'event-acm',
    category: 'event',
    title: 'Resume Workshop with Industry Mentors',
    match_percent: 92,
    reason: 'Matches software engineering and career development',
  },
]
