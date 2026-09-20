export type View = 'home' | 'parking' | 'spots' | 'clubs' | 'profile'

export type Student = {
  full_name: string
  major: string
}

export type NextClass = {
  course_code: string
  start_time: string
  building_name: string
  minutes_until: number | null
}

export type RecCategory = 'parking' | 'spot' | 'event'

export type Recommendation = {
  id: string
  category: RecCategory
  title: string
  match_percent: number
  reason: string
}
