export type View = 'home' | 'parking' | 'spots' | 'clubs' | 'events' | 'profile'

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
  permit_type: Permit
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
  day_of_week: number
  day_offset: number
  minutes_until: number | null
}

// CSUF renamed every lot in summer 2025. E is employee, S is student, R is
// resident, and there is no visitor lot at all: visitors buy an hourly permit
// and use one of the hourly zones.
export type Permit = 'student' | 'employee' | 'resident' | 'visitor'

export type ParkingLot = {
  id: string
  name: string
  lat: number
  lng: number
  // a list, not one value, because the structures take several. Nutwood is
  // student, employee and hourly all at once.
  permits: Permit[]
  // null where CSUF does not publish a capacity, which is most of them. Only
  // the facilities on the live counts board have a real figure.
  total_spaces: number | null
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
  kind: SpotKind
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

export type SpotKind = 'study' | 'eat' | 'charge' | 'meet'

export type RecCategory = 'parking' | 'spot' | 'event'

export type Recommendation = {
  id: string
  category: RecCategory
  // only set for spots: a spot can be a study floor, a food place, somewhere to
  // meet or somewhere to charge, and the card should not call them all study
  kind?: SpotKind | null
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
