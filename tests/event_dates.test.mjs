// The checks that would have caught the empty Events screen.
// src/lib/eventDates.ts has the why. These need no emulator and no Firebase
// project, just Node 22.18 or newer:
//
//   npm run test:dates
import test from 'node:test'
import assert from 'node:assert/strict'

import { events } from '../src/lib/campusRows.ts'
import { datedEvents, eventWindow } from '../src/lib/eventDates.ts'

const CAMPUS_TZ = 'America/Los_Angeles'

// "YYYY-MM-DD, HH:MM" on campus, whatever the machine running this is set to.
function onCampus(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

function quietly(run) {
  const warn = console.warn
  console.warn = () => {}
  try { return run() } finally { console.warn = warn }
}

// Dates picked to sit either side of the November clock change and far enough
// out that a stored timestamp would long since have expired.
const DAYS = ['2026-10-27', '2026-11-02', '2026-11-30', '2026-12-15', '2027-03-08']

test('every event is still upcoming, whenever it is read', () => {
  for (const day of DAYS) {
    const now = new Date(`${day}T19:00:00Z`)
    const rows = datedEvents(events, now)
    assert.equal(rows.length, events.length, `lost events on ${day}`)
    const past = rows.filter((e) => Date.parse(e.starts_at) <= now.getTime())
    assert.deepEqual(past, [], `events already over on ${day}`)
  }
})

test('an event lands at the campus time its row asks for', () => {
  for (const day of DAYS) {
    for (const e of datedEvents(events, new Date(`${day}T19:00:00Z`))) {
      const [, time] = onCampus(e.starts_at).split(', ')
      assert.equal(time, e.at, `${e.title} on ${day}`)
    }
  }
})

// The offset counts from the campus day, which is not the UTC day late in the
// evening. Reading at 05:00 UTC on November 5 is still November 4 on campus,
// so a day_offset of 0 belongs on the 4th. Without this the suite passes even
// if the campus timezone is dropped entirely, as long as the machine running
// it happens to sit west of Greenwich.
test('the day comes from the campus date, not the machine or UTC', () => {
  const lateEvening = new Date('2026-11-05T05:00:00Z')
  const [first] = datedEvents([{ day_offset: 0, at: '16:00', duration_minutes: 90 }], lateEvening)
  assert.equal(onCampus(first.starts_at), '2026-11-04, 16:00')
})

// Written out rather than recomputed. Deriving the answer the same way the
// code does would pass even if that way were wrong, and stepping the date is
// exactly the part worth pinning across a year boundary.
test('the day offset carries across a year boundary', () => {
  const newYear = new Date('2026-12-29T19:00:00Z')
  const six = eventWindow({ day_offset: 6, at: '11:00', duration_minutes: 90 }, newYear)
  assert.equal(onCampus(six.starts_at), '2027-01-04, 11:00')

  const leap = new Date('2028-02-26T19:00:00Z')
  const three = eventWindow({ day_offset: 3, at: '09:00', duration_minutes: 30 }, leap)
  assert.equal(onCampus(three.starts_at), '2028-02-29, 09:00')
})

test('an event runs for as long as it says', () => {
  for (const e of datedEvents(events)) {
    const minutes = (Date.parse(e.ends_at) - Date.parse(e.starts_at)) / 60000
    assert.equal(minutes, e.duration_minutes, e.title)
  }
})

// One offset per calendar date is not enough on the two days a year the
// clocks move: midday is the wrong side of the change for anything early.
test('the clocks moving does not drag an event to the wrong time', () => {
  const back = new Date('2026-11-01T19:00:00Z')
  for (const at of ['00:00', '01:00', '02:00', '16:00']) {
    const w = eventWindow({ day_offset: 0, at, duration_minutes: 90 }, back)
    assert.equal(onCampus(w.starts_at), `2026-11-01, ${at}`, `autumn, ${at}`)
  }

  const forward = new Date('2027-03-14T19:00:00Z')
  assert.equal(
    onCampus(eventWindow({ day_offset: 0, at: '00:00', duration_minutes: 90 }, forward).starts_at),
    '2027-03-14, 00:00', 'spring, midnight must not fall back a day',
  )
  // 02:00 to 02:59 does not happen on that morning, so forward is the only
  // sensible answer. What matters is that it does not step backwards.
  assert.equal(
    onCampus(eventWindow({ day_offset: 0, at: '02:30', duration_minutes: 90 }, forward).starts_at),
    '2027-03-14, 03:30', 'spring, the hour that does not exist',
  )
})

// Fed in backwards on purpose. Firestore hands rows back in document name
// order, which is event-0, event-1, event-10, event-11, event-2, so an input
// that is already sorted proves nothing.
test('events come back in order whatever order they arrive in', () => {
  const shuffled = [...events].reverse()
  const rows = datedEvents(shuffled)
  const times = rows.map((e) => e.starts_at)
  assert.deepEqual(times, [...times].sort(), 'not in time order')
  assert.equal(rows.length, events.length)
})

// A project seeded before this change still holds documents with a starts_at
// and no day offset. Dating one throws, and one throw used to lose the whole
// collection, which took the dashboard and parking down with the events.
test('a row that cannot be dated is dropped, not fatal', () => {
  const good = { id: 'ok', day_offset: 1, at: '09:00', duration_minutes: 60 }
  const oldShape = { id: 'old', starts_at: '2026-10-14T23:00:00.000Z', tags: [] }

  const rows = quietly(() => datedEvents([good, oldShape, { ...good, id: 'ok2' }]))
  assert.deepEqual(rows.map((e) => e.id), ['ok', 'ok2'])

  for (const broken of [
    { ...good, at: '09:00:00' },      // the HH:MM:SS form the old database returned
    { ...good, at: '25:00' },
    { ...good, day_offset: '2' },     // a string would concatenate, not add
    { ...good, duration_minutes: 0 },
    { ...good, at: undefined },
  ]) {
    assert.deepEqual(quietly(() => datedEvents([broken])), [], JSON.stringify(broken.at ?? broken))
  }
})

// Firestore hands back whatever the seed wrote, so this is the shape the rest
// of the app is entitled to assume.
test('a stored row needs no date of its own', () => {
  const stored = { day_offset: 2, at: '09:30', duration_minutes: 45 }
  const { starts_at, ends_at } = eventWindow(stored, new Date('2026-12-15T19:00:00Z'))
  assert.equal(onCampus(starts_at), '2026-12-17, 09:30')
  assert.equal(onCampus(ends_at), '2026-12-17, 10:15')
})
