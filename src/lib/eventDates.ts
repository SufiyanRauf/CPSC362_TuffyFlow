// Club events are sample data, and the date on one is worked out from the day
// it is read rather than stored as a fixed timestamp.
//
// The reason is the Events screen going blank. A stored timestamp is right on
// the day it was seeded and wrong a week later, so every demo depended on
// somebody remembering to run db/seed_firestore.mjs first, with the admin key
// sitting on the laptop. Miss it and a signed in account sees an empty screen,
// while the demo that needs no account looks fine, because that half has
// always built its dates at page load. This is that half's arithmetic, moved
// somewhere both can use it, so the two cannot disagree about when an event is.
//
// What Firestore holds is the day offset and the time of day. Turning those
// into timestamps is this file's job and nowhere else's.
import type { CampusEvent, StoredEvent } from '../types'
import { CAMPUS_TZ } from './time'

// Campus is on daylight time for part of the year, so the offset has to be
// asked for per date rather than hard coded. It matters more now than it did:
// the clocks go back on November 1 and the demos run past it, so a fixed
// offset would read an hour out for every event after that.
function campusOffset(isoDate: string) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPUS_TZ, timeZoneName: 'longOffset',
  }).formatToParts(new Date(`${isoDate}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-08:00'
  return name.replace('GMT', '') || '-08:00'
}

// Today on campus, not on whichever laptop is running the demo. en-CA is the
// locale that gives YYYY-MM-DD.
function campusToday(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

// The two timestamps for one event. now is a parameter so a test can ask what
// some other day looks like without moving the clock.
export function eventWindow(event: StoredEvent, now: Date = new Date()) {
  // The date is stepped in UTC and read back as a plain date, which keeps the
  // arithmetic off the hours daylight saving moves. The offset is applied
  // once, below, for whichever date we land on.
  const day = new Date(`${campusToday(now)}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + event.day_offset)
  const date = day.toISOString().slice(0, 10)

  const starts = new Date(`${date}T${event.at}:00${campusOffset(date)}`)
  const ends = new Date(starts.getTime() + event.duration_minutes * 60_000)
  return { starts_at: starts.toISOString(), ends_at: ends.toISOString() }
}

// Both halves of the app go through here: campusData.ts for the demo rows and
// firestoreData.ts for the real ones. One function doing it is the point, so
// that a stored row and a sample row can never come out dated differently.
//
// Sorted here as well, because the screens show these in order and Firestore
// cannot sort on a field that is no longer stored.
export function datedEvents(rows: StoredEvent[], now: Date = new Date()): CampusEvent[] {
  return rows
    .map((row) => ({ ...row, ...eventWindow(row, now) }))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
}
