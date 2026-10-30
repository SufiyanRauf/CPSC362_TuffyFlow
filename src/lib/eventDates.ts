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
// The extension is spelled out so that Node can load this file directly, the
// way db/seed_firestore.mjs already loads campusRows.ts. Vite and tsc both
// take it either way, and tests/event_dates.test.mjs needs it.
import { CAMPUS_TZ } from './time.ts'

// Built once at module load, not inside the two functions below. Building an
// Intl.DateTimeFormat is the expensive part, reading a date with one is cheap,
// and these were being rebuilt three times per event: dating twelve events
// built thirty six formatters to read twelve dates. Neither one closes over anything, so
// there is nothing per call to keep them out of module scope, and an instance
// is safe to hand a different date every time.
const OFFSET_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TZ, timeZoneName: 'longOffset',
})

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAMPUS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
})

// The campus offset at a given instant, as "-07:00" or "-08:00". Asked for
// rather than hard coded, because campus is on daylight time for part of the
// year and the demos run across the November change.
function offsetAt(when: Date) {
  const name = OFFSET_FORMAT.formatToParts(when)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-08:00'
  return name.replace('GMT', '') || '-08:00'
}

// Today on campus, not on whichever laptop is running the demo. en-CA is the
// locale that gives YYYY-MM-DD.
function campusToday(now: Date) {
  return DAY_FORMAT.format(now)
}

// A row we cannot work a date out of. Firestore gives back whatever is in the
// document, and a project seeded before this change holds the old shape, with
// a starts_at and none of these. Dating that row throws on an invalid date,
// and one throw used to lose the whole collection, so this is checked per row
// and the bad ones are dropped.
function datable(event: StoredEvent) {
  return Number.isInteger(event.day_offset)
    && Number.isInteger(event.duration_minutes)
    && event.duration_minutes > 0
    && typeof event.at === 'string'
    && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(event.at)
}

// The two timestamps for one event. now is a parameter so a test can ask what
// some other day looks like without moving the clock.
export function eventWindow(event: StoredEvent, now: Date = new Date()) {
  // The date is stepped in UTC and read back as a plain date, which keeps the
  // arithmetic off the hours daylight saving moves. setUTCDate carries across
  // months and years on its own.
  const day = new Date(`${campusToday(now)}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + event.day_offset)
  const date = day.toISOString().slice(0, 10)

  // Twice, and the second time is not redundant. The first offset is read at
  // midday, which on the two days a year the clocks move is the wrong side of
  // the change for anything scheduled before 3am: the hour that does not
  // exist in March would step backwards, and midnight would land on the
  // previous day. Reading the offset again at the instant we just built, and
  // rebuilding if it disagrees, puts both back.
  const guess = offsetAt(new Date(`${date}T12:00:00Z`))
  let starts = new Date(`${date}T${event.at}:00${guess}`)
  const actual = offsetAt(starts)
  if (actual !== guess) starts = new Date(`${date}T${event.at}:00${actual}`)

  const ends = new Date(starts.getTime() + event.duration_minutes * 60_000)
  return { starts_at: starts.toISOString(), ends_at: ends.toISOString() }
}

// Both halves of the app go through here: campusData.ts for the demo rows and
// firestoreData.ts for the real ones. One function doing it is the point, so
// that a stored row and a sample row can never come out dated differently.
//
// Sorted here as well, because Firestore cannot sort on a field it is no
// longer storing, and getDocs hands rows back in document name order, which
// puts event-10 between event-1 and event-2.
export function datedEvents(rows: StoredEvent[], now: Date = new Date()): CampusEvent[] {
  const usable = rows.filter(datable)
  if (usable.length !== rows.length) {
    // Worth saying out loud. The likeliest cause is a project still holding
    // what the old seed wrote, which one run of db/seed_firestore.mjs fixes.
    console.warn(
      `Ignoring ${rows.length - usable.length} event(s) with no usable day offset or time. `
      + 'If this is a project seeded before events stopped storing dates, run db/seed_firestore.mjs once.',
    )
  }
  return usable
    .map((row) => ({ ...row, ...eventWindow(row, now) }))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
}
