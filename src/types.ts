export type View = 'home' | 'parking' | 'spots' | 'clubs' | 'events' | 'profile'

export type Building = {
  id: string
  name: string
  // The campus abbreviation, MH or CS, which is how the campus map labels a
  // building. Kept because it is what the SQL seed matched rows on, so it is
  // the link back to where each row came from. Nothing reads it yet: every
  // screen shows the full name.
  code: string
  lat: number
  lng: number
}

// Four of these are nullable because the database says so, and the database
// says so because a brand new account genuinely does not know them yet. All
// signup has to go on is whatever the form or Google handed over, so the rest
// stays empty until the profile screen is filled in. Writing a default in
// instead would be the app inventing a permit type and a noise preference on
// someone's behalf, and then scoring their day against the invention.
export type Profile = {
  id: string
  full_name: string | null
  major: string | null
  interests: string[]
  career_goals: string[]
  permit_type: Permit | null
  noise_pref: number | null
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
  building_lat: number
  building_lng: number
  start_minutes: number
  day_of_week: number
  day_offset: number
  // Never null. It used to be typed as nullable, which bought an "No more
  // classes today" card that nothing could ever reach: a Friday evening still
  // has a next class, it is just days out. Having no classes at all is a
  // different thing and the dashboard handles it.
  minutes_until: number
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
  // a list, not one value, because most lots take several. Nutwood is student,
  // employee and hourly all at once; Eastside North is student only.
  permits: Permit[]
  // null where CSUF does not publish a capacity, which is most of them. Only
  // the facilities on the live counts board have a real figure. Kept as a
  // record of what the published figure was when the rows were written.
  // Nothing reads it yet: the parking screen works off typical_pct_full.
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
  // When it is open, by day of the week: 0 is Sunday. A day that is not here
  // is a day it is shut, which is the whole point of the shape. There used to
  // be one opens_at and one closes_at, which held the Monday to Thursday
  // hours and said nothing about the rest of the week, so on a Saturday the
  // app offered fifteen of the sixteen food places and on a Sunday all of
  // them.
  hours: SpotHours
  // The published wording, condensed. hours above is derived from it, and this
  // is what the screen shows, so the two cannot drift without being noticed.
  hours_note: string | null
}

// Three of these are nullable because db/schema.sql has them nullable. Every
// one of the 320 rows in the seed happens to fill all three in, so nothing
// shows it today, but TitanLink does carry organizations with no summary and
// no page of their own, and the next import would bring them in.
export type Club = {
  id: string
  // The organization's own id on TitanLink, where these rows were scraped
  // from. Kept so a row can be traced back to the page it came from and so a
  // later import can match on it. Nothing reads it yet.
  titanlink_id: string | null
  name: string
  summary: string | null
  website_key: string | null
  categories: string[]
  tags: string[]
}

// What Firestore actually holds for an event. There is no date on it: the day
// offset and the time of day are stored instead, and src/lib/eventDates.ts
// says why. The seed writes exactly these fields.
export type StoredEvent = {
  id: string
  club_id: string
  club_name: string
  title: string
  day_offset: number
  at: string
  duration_minutes: number
  building_id: string
  tags: string[]
}

// What the screens are handed: the stored fields, plus the two timestamps
// worked out from them at the moment the row is read. Everything that renders
// or scores an event reads starts_at and ends_at and does not need to know
// they were derived.
export type CampusEvent = StoredEvent & {
  starts_at: string
  ends_at: string
}

export type SpotKind = 'study' | 'eat' | 'charge' | 'meet'

// Day of week to opening and closing time, both "HH:MM". An empty object means
// we do not know the hours, which is not the same as being shut all week.
//
// Partial, because a day that is missing is a day the place is shut and that
// is most of the food court on a Sunday. A plain Record claims every day is
// in here, which made the "is it shut today" check look like dead code to
// anybody reading the type instead of the data.
export type SpotHours = Partial<Record<number, [opens: string, closes: string]>>

export type RecCategory = 'parking' | 'spot' | 'event'

export type Recommendation = {
  id: string
  category: RecCategory
  // only set for spots: a spot can be a study floor, a food place, somewhere to
  // meet or somewhere to charge, and the card should not call them all study
  kind?: SpotKind | null
  title: string
  match_percent: number
  reasons: string[]
  lat: number | null
  lng: number | null
  walk_minutes: number | null
  // parking only, and null when the hour has no typical reading. The scorer
  // sends the number so the screen does not have to read it back out of the
  // sentence next to it.
  pct_full: number | null
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
