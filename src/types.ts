// Field names match the database columns, underscores and all. Renaming them on
// this side means keeping a translation layer in sync, and when it drifts you get
// undefined rather than an error.

export type View = 'home' | 'parking' | 'spots' | 'clubs' | 'profile'

export type Student = {
  full_name: string
  major: string
}

export type NextClass = {
  course_code: string
  start_time: string       // comes out of Postgres as "11:30:00", formatted for display
  building_name: string    // flattened from buildings.name, it is not on class_meetings
  minutes_until: number | null   // worked out from the current time
}

// not called "kind" because spots.kind already means something else
export type RecCategory = 'parking' | 'spot' | 'event'

export type Recommendation = {
  id: string
  category: RecCategory
  title: string
  match_percent: number    // always 0 to 100, never a 0 to 1 fraction
  reason: string
}
