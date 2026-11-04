// The occupancy curve had no test at all. It is the only data the parking
// screen shows, 1324 rows of it, and a change to the evening shape rewrote 220
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

test('every board reading is reproduced by the curve, or has no row at all', () => {
  const all = readings()
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

test('Eastside South has no evening row on the days the reading covers', () => {
  // Both Tuesday readings put it at twenty cars in 1341 spaces, unchanged
  // across half an hour in which 190 cars left the rest of campus. That reads
  // as a structure that was not taking cars, so it is left out rather than
  // written in as the best evening parking on campus.
  for (const day of [1, 2, 3, 4]) {
    for (const hour of [17, 18, 19, 20, 21]) {
      assert.equal(row('lot-esps', day, hour), undefined,
        `Eastside South should have no row for day ${day} hour ${hour}`)
    }
  }
  // but it is still there during the day, and at the weekend
  assert.ok(row('lot-esps', 2, 13), 'Eastside South lost its afternoon')
  assert.ok(row('lot-esps', 0, 13), 'Eastside South lost its Sunday')
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
