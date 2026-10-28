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

async function write(name, rows) {
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
// percentage. As documents of its own it is 1,344 of them, and Firestore
// charges by the document read, so every parking screen would be 1,344 reads
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
