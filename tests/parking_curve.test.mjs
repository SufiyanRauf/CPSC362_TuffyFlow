// The occupancy curve had no test at all. It is the only data the parking
// screen shows, 1232 rows of it, and a change to the evening shape rewrote 220
// of them without anything turning red. These read the board readings back out
// of data/parking_samples.csv, so adding a reading to that file is enough to
// check the curve against it, and a refit that drifts away from a reading it
// is supposed to reproduce fails here rather than in front of a student.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lotAvailability, parkingLots } from '../src/lib/campusRows.ts'

// The board's own labels, which are not the names the lots carry in the app.
// S8 and S10 are reported as one row, so the pair's reading is the best we
// have for either of them on its own and both are checked against it.
const BOARD = {
  'Nutwood Structure': ['lot-nps'],
  'State College Structure': ['lot-scps'],
  'Eastside North': ['lot-enps'],
  'Eastside South': ['lot-esps'],
  'S8 and S10': ['lot-s8', 'lot-s10'],
}
const DAYS = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
               Thursday: 4, Friday: 5, Saturday: 6 }

// The bar the second Thursday reading set, and the one the CSV quotes.
const WITHIN = 3

function readings() {
  const text = readFileSync(new URL('../data/parking_samples.csv', import.meta.url), 'utf8')
  return text.split('\n').filter((l) => /^\d{4}-/.test(l)).map((line) => {
    const [date, day, time, lot, total, free] = line.split(',')
    return {
      date, day, time, lot,
      hour: Number(time.split(':')[0]),
      pct: ((Number(total) - Number(free)) / Number(total)) * 100,
    }
  })
}

const row = (id, day, hour) =>
  lotAvailability.find((r) => r.lot_id === id && r.day_of_week === day && r.hour === hour)

// Readings the curve has NOT been fitted to, and why. Listed rather than
// quietly skipped, because the whole point of this file is that the curve is
// checked against the board instead of against numbers somebody typed. A
// reading in here is a known debt; the test below proves each one is still
// genuinely off, so refitting the curve makes this list fail until it is
// emptied, rather than leaving a stale exemption behind.
const NOT_FITTED = {
  '2026-10-01 13:11': 'Taken while Eastside South was open and the fullest '
    + 'structure on campus. It closed between 30 October and 3 November and '
    + 'its 1341 spaces of demand moved into the other three, so this reading '
    + 'describes a campus that no longer exists. Kept as a record.',
  '2026-10-01 13:57': 'The second of the same pair, same reason.',
}

test('every board reading is reproduced by the curve, or has no row at all', () => {
  const all = readings().filter((r) => !NOT_FITTED[`${r.date} ${r.time}`])
  assert.ok(all.length >= 20, `expected the samples file to have rows, got ${all.length}`)
  for (const r of all) {
    for (const id of BOARD[r.lot]) {
      const got = row(id, DAYS[r.day], r.hour)
      // A missing row is allowed and is not a silent pass: it means the seed
      // deliberately claims no typical reading for that lot at that hour, and
      // the card says so. Eastside South in the evening is the one case.
      if (!got) continue
      const off = Math.abs(got.typical_pct_full - r.pct)
      assert.ok(off <= WITHIN,
        `${r.lot} ${r.day} ${r.time}: curve says ${got.typical_pct_full}%, `
        + `board said ${r.pct.toFixed(2)}%, off by ${off.toFixed(2)}`)
    }
  }
})

test('the lot a reading names is a lot that exists', () => {
  for (const ids of Object.values(BOARD)) {
    for (const id of ids) {
      assert.ok(parkingLots.some((l) => l.id === id), `${id} is not a lot`)
    }
  }
  for (const r of readings()) {
    assert.ok(BOARD[r.lot], `${r.lot} in the samples file matches no lot`)
  }
})

test('every hour of every day carries a percentage that could be real', () => {
  // 1 and 99 rather than 0 and 100: the seed never claims a lot is literally
  // empty or literally full, because neither is something we measured.
  for (const r of lotAvailability) {
    assert.ok(Number.isInteger(r.typical_pct_full), `${r.lot_id} ${r.day_of_week} ${r.hour} is not whole`)
    assert.ok(r.typical_pct_full >= 1 && r.typical_pct_full <= 99,
      `${r.lot_id} ${r.day_of_week} ${r.hour} is ${r.typical_pct_full}`)
  }
})

test('the readings we have not fitted to are still genuinely off', () => {
  // If the curve is refitted and starts matching one of these, this fails and
  // the entry has to come out of NOT_FITTED. That keeps the exemption list
  // from outliving the reason for it.
  for (const key of Object.keys(NOT_FITTED)) {
    const group = readings().filter((r) => `${r.date} ${r.time}` === key)
    assert.ok(group.length > 0, `${key} is exempted but is not in the samples file`)
    const offs = group.flatMap((r) => BOARD[r.lot].map((id) => {
      const got = row(id, DAYS[r.day], r.hour)
      return got ? Math.abs(got.typical_pct_full - r.pct) : null
    })).filter((x) => x !== null)
    assert.ok(offs.some((o) => o > WITHIN),
      `${key} now matches the curve to within ${WITHIN} points, so it is no `
      + 'longer a known debt and should come out of NOT_FITTED')
  }
})

test('a lot that is not taking cars is kept out of the grid entirely', () => {
  // Eastside South reads exactly 1321 free in all five readings in
  // data/parking_samples.csv, across four days, including a midday where
  // every other structure was over 90 percent full and a Sunday night three
  // days after the one before it. A structure
  // nobody can get into has no typical occupancy, so it carries no rows at
  // any hour of any day.
  const closed = parkingLots.filter((l) => l.taking_cars === false)
  assert.ok(closed.length > 0, 'expected at least one lot marked not taking cars')
  for (const lot of closed) {
    const rows = lotAvailability.filter((r) => r.lot_id === lot.id)
    assert.equal(rows.length, 0, `${lot.name} should carry no availability rows`)
  }
  // and every other lot still carries a full week
  for (const lot of parkingLots.filter((l) => l.taking_cars !== false)) {
    const rows = lotAvailability.filter((r) => r.lot_id === lot.id)
    assert.ok(rows.length > 0, `${lot.name} lost its availability`)
  }
})

test('the evening shape applies to weekdays only, and not to Friday', () => {
  // Friday keeps its own curve all day: the one Friday reading is a midday
  // one and says nothing about a Friday night.
  const fridayEvening = row('lot-nps', 5, 18).typical_pct_full
  const tuesdayEvening = row('lot-nps', 2, 18).typical_pct_full
  assert.notEqual(fridayEvening, tuesdayEvening)
  // and the weekend is untouched by any of it
  assert.equal(row('lot-nps', 0, 18).typical_pct_full, row('lot-nps', 6, 18).typical_pct_full)
})

test('the weekend empties in the evening only where it was measured', () => {
  // Two Sunday readings nine hours apart. S8 and S10 fell eleven points
  // between them and the three open structures did not move, so only the one
  // pair carries a weekend slide. If a later refit flattens S8 and S10 again,
  // or starts sliding the structures on no evidence, this fails.
  for (const id of ['lot-s8', 'lot-s10']) {
    const noon = row(id, 0, 12).typical_pct_full
    const night = row(id, 0, 21).typical_pct_full
    assert.ok(noon - night >= 10,
      `${id} should fall at least 10 points from noon to 21:00 on a Sunday, `
      + `got ${noon} to ${night}`)
  }
  for (const id of ['lot-nps', 'lot-scps', 'lot-enps']) {
    const noon = row(id, 0, 12).typical_pct_full
    const night = row(id, 0, 21).typical_pct_full
    assert.ok(Math.abs(noon - night) <= 3,
      `${id} was read flat across a Sunday, so the curve should be flat too, `
      + `got ${noon} to ${night}`)
  }
  // Saturday still inherits Sunday whole: nobody has read a Saturday.
  assert.equal(row('lot-s8', 6, 21).typical_pct_full, row('lot-s8', 0, 21).typical_pct_full)
})
