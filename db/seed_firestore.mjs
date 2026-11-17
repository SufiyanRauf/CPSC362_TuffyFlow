// Load the campus into Firestore.
//
//   node db/seed_firestore.mjs path/to/serviceAccountKey.json
//
// The key comes from the Firebase console, under Project settings, Service
// accounts, Generate new private key. It is the one piece of this project that
// really is a secret: it bypasses every rule in db/firestore.rules, which is
// exactly why the seed can write collections a browser never may. Keep it
// outside the repository, or inside it under a name .gitignore already covers.
// Never commit it, and never paste it anywhere.
//
// Safe to run again, and you should not need to: nothing it writes expires.
// Events used to, which is the story in src/lib/eventDates.ts. One run covers
// every demo from here on.
//
// Run it once against a project that was seeded before that change, though.
// Those documents hold a starts_at and no day offset, and the app has to skip
// what it cannot date.
//
// Every document is written at an id we choose, so a second run overwrites
// rather than duplicating. It does not delete: a club removed from
// campusRows.ts leaves its old document behind, and the app would still show
// it. Clear the collection by hand if that ever matters.
//
// It reads the same rows the app shows when nobody is signed in, straight out
// of src/lib/campusRows.ts, so the demo and a real project cannot drift apart.

// Needs Node 22.18 or newer, which reads the TypeScript import below without
// a build step. On an older Node it fails with ERR_UNKNOWN_FILE_EXTENSION and
// nothing pointing at why.
import { readFileSync } from 'node:fs'
import { argv, exit } from 'node:process'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import {
  buildings, clubs, events, lotAvailability, parkingLots, spots,
} from '../src/lib/campusRows.ts'

const keyPath = argv[2]
if (!keyPath) {
  console.error('Usage: node db/seed_firestore.mjs path/to/serviceAccountKey.json')
  exit(1)
}

let key
try {
  key = JSON.parse(readFileSync(keyPath, 'utf8'))
} catch (e) {
  console.error(`Could not read the service account key at ${keyPath}`)
  console.error(e.message)
  exit(1)
}

initializeApp({ credential: cert(key) })
const db = getFirestore()

// Firestore takes at most 500 writes in one batch, and the club list alone is
// 320, so everything goes through this rather than counting by hand.
const BATCH_LIMIT = 500

// The counts the SQL seed asserts, kept here because this is the file that
// actually runs now. db/seed_events.sql raises if it writes anything other
// than 12 events, and it does that because a club rename once dropped eleven
// of the twelve without a single error: the event join is by name, and a name
// that matches nothing writes the event with an empty club_id rather than
// failing. That guard did not come across with the move to Firestore, so it
// is here.
const EXPECTED = { clubs: 320, spots: 24, events: 12 }

// Every building id any row points at. Built here rather than inside write()
// so the check below cannot depend on which collection went in first.
const BUILDING_IDS = new Set(buildings.map((b) => b.id))

async function write(name, rows) {
  const want = EXPECTED[name]
  if (want !== undefined && rows.length !== want) {
    throw new Error(
      `${name}: expected ${want} rows and have ${rows.length}. `
      + 'A club or building name no longer matches, or the source data moved.')
  }
  // The count on its own cannot catch what this guard is for. buildEvents
  // maps over twelve literals, so twelve rows come out whether or not the
  // host names matched; an unmatched one writes club_id: '' instead of
  // disappearing. The SQL this was ported from used an inner join, which
  // dropped the row and made counting enough. This is the same check for a
  // join that does not drop.
  const orphans = rows.filter((row) => row.club_id === '')
  if (orphans.length > 0) {
    throw new Error(
      `${name}: ${orphans.length} row(s) name a club that does not exist: `
      + `${orphans.map((row) => row.club_name).join(', ')}.`)
  }
  // The other half of the same join, which did not come across either. A club
  // is matched by name and leaves club_id empty when it misses, which is what
  // the check above reads. building_id is written straight out of the row with
  // no lookup at all, so nothing marks a building that was renamed or recoded:
  // the row goes in pointing at a building that is not there, and recommend.ts
  // drops any spot or event whose building it cannot find. That is the same
  // eleven-of-twelve disappearance as the club rename, from the other key, and
  // it is also what the count of 24 spots used to cover: in SQL the spots
  // joined on a building code and a miss dropped the row, so the count caught
  // it. Here spots is a list of literals and the count cannot move, so this is
  // the check that does the work.
  const nowhere = rows.filter(
    (row) => row.building_id != null && !BUILDING_IDS.has(row.building_id))
  if (nowhere.length > 0) {
    throw new Error(
      `${name}: ${nowhere.length} row(s) point at a building that does not exist: `
      + `${nowhere.map((row) => `${row.name ?? row.title} -> ${row.building_id}`).join(', ')}.`)
  }
  for (let from = 0; from < rows.length; from += BATCH_LIMIT) {
    const batch = db.batch()
    for (const row of rows.slice(from, from + BATCH_LIMIT)) {
      const { id, ...fields } = row
      batch.set(db.collection(name).doc(id), fields)
    }
    await batch.commit()
  }
  console.log(`${name.padEnd(14)} ${String(rows.length).padStart(4)} documents`)
}

// Occupancy is folded onto the lot it belongs to, as day then hour then
// percentage. As documents of its own it is 1,232 of them, and Firestore
// charges by the document read, so every parking screen would be 1,232 reads
// for twelve lots' worth of numbers.
function lotsWithOccupancy() {
  const byLot = new Map(parkingLots.map((lot) => [lot.id, {}]))
  for (const row of lotAvailability) {
    const week = byLot.get(row.lot_id)
    if (!week) continue
    week[row.day_of_week] ??= {}
    week[row.day_of_week][row.hour] = row.typical_pct_full
  }
  return parkingLots.map((lot) => ({ ...lot, availability: byLot.get(lot.id) }))
}

async function main() {
  console.log(`Seeding project ${key.project_id}\n`)

  await write('buildings', buildings)
  await write('parking_lots', lotsWithOccupancy())
  // building_name and club_name are already on these rows. Firestore has no
  // joins, so a name a screen wants has to be stored beside the thing that
  // wants it, and this script is the only place the two can drift apart.
  await write('spots', spots)
  await write('clubs', clubs)
  await write('events', events)

  // Printed as offsets rather than dates, because an offset is what went in
  // and a date would imply these belong to the day they were seeded.
  const offsets = events.map((e) => e.day_offset)
  const first = Math.min(...offsets) === 0 ? 'today' : `day ${Math.min(...offsets)}`
  console.log(`\nEvents run ${first} to day ${Math.max(...offsets)}, worked out whenever`)
  console.log('they are read, so this does not need running again before a demo.')
  console.log('\nProfiles and schedules are not seeded: they belong to a person,')
  console.log('and the app writes one the first time somebody signs in.')
}

main().catch((e) => {
  console.error('\nSeeding failed.')
  console.error(e.message)
  exit(1)
})
