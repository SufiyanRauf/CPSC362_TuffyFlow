export type View = 'home' | 'parking' | 'spots' | 'clubs' | 'profile'

export type Building = {
  id: string
  name: string
  code: string
  lat: number
  lng: number
}

export type Profile = {
  id: string
  full_name: string
  major: string
  interests: string[]
  career_goals: string[]
  permit_type: 'student' | 'staff' | 'visitor'
  noise_pref: number
}

export type ClassMeeting = {
  id: string
  profile_id: string
  course_code: string
  day_of_week: number
  start_time: string
  end_time: string
  building_id: string
}

export type NextClass = {
  course_code: string
  start_time: string
  building_id: string
  building_name: string
  minutes_until: number | null
}

export type ParkingLot = {
  id: string
  name: string
  lat: number
  lng: number
  permit_type: 'student' | 'staff' | 'visitor'
  total_spaces: number
}

export type LotAvailability = {
  lot_id: string
  day_of_week: number
  hour: number
  typical_pct_full: number
}

export type Spot = {
  id: string
  name: string
  kind: 'study' | 'eat' | 'charge' | 'meet'
  building_id: string
  building_name: string
  floor: number | null
  section: 'North' | 'South' | null
  noise_level: number
  has_outlets: boolean
  is_indoor: boolean
  seats: number | null
  reservable: boolean
  opens_at: string | null
  closes_at: string | null
  hours_note: string | null
}

export type Club = {
  id: string
  titanlink_id: string
  name: string
  summary: string
  website_key: string
  categories: string[]
  tags: string[]
}

export type CampusEvent = {
  id: string
  club_id: string
  club_name: string
  title: string
  starts_at: string
  ends_at: string
  building_id: string
  tags: string[]
}

export type RecCategory = 'parking' | 'spot' | 'event'

export type Recommendation = {
  id: string
  category: RecCategory
  title: string
  match_percent: number
  reason: string
  reasons: string[]
  lat: number | null
  lng: number | null
  walk_minutes: number | null
  arrive_by: string | null
}

export type RecommendResponse = {
  parking: Recommendation[]
  spots: Recommendation[]
  events: Recommendation[]
}

export type Loadable<T> =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; data: T }
