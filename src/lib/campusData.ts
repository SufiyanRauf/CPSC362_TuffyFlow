// The one way in to any campus data at all.
//
// Two sources, one set of names. A signed in student gets their own rows out
// of Firestore; the demo, and anyone running this without a project of their
// own, gets the sample campus in campusRows.ts. Deciding it here rather than
// in each screen is what let sign in go in without any screen having to ask
// which source it is reading.
//
// All or nothing on purpose, though the reason has narrowed. The seed writes
// each campus document at the id the sample rows already use, so b-cs is b-cs
// in both places and a mixed screen would join rather than break. What still
// differs is a student's own rows: a class added to an account gets an id
// built from the class, and one added in the demo gets cm-new-1.

import type {
  Building, Profile, ClassMeeting, ParkingLot, LotAvailability,
  Spot, Club, CampusEvent,
} from '../types'
import {
  buildings, clubs, demoClassMeetings, demoProfile, events, lotAvailability,
  parkingLots, spots,
} from './campusRows'
import { datedEvents } from './eventDates'
import { accountId, accountName } from './session'
import { dataChanged, dataVersion } from './dataVersion'
import * as live from './firestoreData'

// What the demo shows right now, which its own screens are allowed to change.
// Cloned out of the sample rows so that an edit here can never reach them.
let profile: Profile = structuredClone(demoProfile)
let classMeetings: ClassMeeting[] = structuredClone(demoClassMeetings)

// ---------------------------------------------------------------------------
// Reads
//
// Two sources, one set of names. A signed in student gets their own rows out
// of Firestore; the demo gets the arrays above. The header of this file says
// why that choice lives here; what is worth adding is how it went: eight of
// the eleven files that read through here changed, four for what accounts
// brought with them and four because a real query has timing a local array
// never had.
// ---------------------------------------------------------------------------

// The campus collections are the same four lists for everybody, and one screen
// load asks for them over and over: each panel runs its own loader and
// getRecommendations reads them again underneath, which was four reads of the
// seventeen buildings and three of the twelve lots to draw one dashboard.
// Firestore charges by the document read and the free tier is about 50,000 a
// day, so the page holds on to what came back.
//
// Keyed on who is asking and on dataVersion() together. The demo and an
// account answer differently, and dataVersion() is already the app's signal
// that the rows behind a screen have moved on, so a write or a sign in cannot
// be served a list from before it. One key for the whole set rather than one
// per list, which also keeps the map from being something that only grows.
let readsFor = ''
const reads = new Map<string, Promise<unknown>>()

function once<T>(what: string, load: () => Promise<T>): Promise<T> {
  // Null covers the demo and signed out, which read the same sample rows.
  const whose = `${accountId() ?? 'sample'}:${dataVersion()}`
  if (whose !== readsFor) {
    reads.clear()
    readsFor = whose
  }

  let pending = reads.get(what) as Promise<T> | undefined
  if (!pending) {
    // The promise, not the rows, so that the panels asking at the same moment
    // share one query instead of starting several.
    //
    // Dropping it on failure matters for the same reason firestoreData.ts
    // drops its SDK import: keeping a rejected promise means one bad read, off
    // campus wifi or a refused rule, keeps failing for the life of the page
    // even after the network comes back.
    pending = load().catch((e: unknown) => {
      reads.delete(what)
      throw e
    })
    reads.set(what, pending)
  }
  return pending
}

// Async because the database ones are. The sample rows never needed it.
export async function getBuildings(): Promise<Building[]> {
  return once('buildings', async () => (accountId() ? live.getBuildings() : buildings))
}
export async function getParkingLots(): Promise<ParkingLot[]> {
  return once('lots', async () => (accountId() ? live.getParkingLots() : parkingLots))
}
export async function getSpots(): Promise<Spot[]> {
  return once('spots', async () => (accountId() ? live.getSpots() : spots))
}
export async function getClubs(): Promise<Club[]> {
  return once('clubs', async () => (accountId() ? live.getClubs() : clubs))
}
export async function getEvents(): Promise<CampusEvent[]> {
  // The sample rows hold a day offset, not a date, so they get dated here the
  // same way the Firestore ones do. Worked out per call rather than once at
  // import, so a tab left open overnight rolls over with the campus day. That
  // is also why this one is not held above: the dates have to be worked out
  // again, and a kept answer would still be on yesterday in the morning.
  return accountId() ? live.getEvents() : datedEvents(events)
}

export async function getProfile(): Promise<Profile> {
  const id = accountId()
  // The name comes from the session rather than the database, because on a
  // brand new account there is no document yet and this is the call that
  // creates it. Firebase is the only thing that knows what to put on it.
  return id ? live.getProfile(id, accountName()) : profile
}

export async function getClassMeetings(): Promise<ClassMeeting[]> {
  const id = accountId()
  return id ? live.getClassMeetings(id) : classMeetings
}

// Only the rows for the arrival hour and the hours either side of it, which is
// what the query filters on too.
export async function getAvailabilityAround(day: number, hour: number): Promise<LotAvailability[]> {
  if (accountId()) return live.getAvailabilityAround(day, hour)
  return lotAvailability.filter(
    (r) => r.day_of_week === day && Math.abs(r.hour - hour) <= 1,
  )
}

// ---------------------------------------------------------------------------
// Writes
//
// A signed in student's edits go to Firestore and are still there next time.
// The demo has nowhere to put them, so they change the arrays above and last
// as long as the tab, which is what the profile screen says they do.
//
// These can now fail, which the demo never could, so they let the error out
// rather than swallowing it. Whatever called has to say so on screen.
// ---------------------------------------------------------------------------

export async function saveProfile(next: Profile) {
  const id = accountId()
  // Whose form is this. The app remounts when the person changes, which is
  // what normally stops a stale form reaching the wrong account, but that
  // is mitigation by timing and this is the check. A form built for one
  // account cannot be written to another.
  //
  // The demo is held to the same rule rather than waved through, because the
  // profile it keeps is where addClassMeeting below reads the owner for a new
  // class. A stale form carrying a real account's id would put that id on
  // rows that are nobody's.
  if (next.id !== (id ?? profile.id)) {
    throw new Error('That form belongs to a different account. Reload the page.')
  }
  if (id) await live.saveProfile(id, next)
  // A spread would keep sharing the interests and career_goals arrays with
  // the form that produced them, which is the same hazard the seed above is
  // cloned to avoid.
  else profile = structuredClone(next)

  dataChanged()
}

let nextClassId = 0

export async function addClassMeeting(meeting: Omit<ClassMeeting, 'id' | 'profile_id'>) {
  const id = accountId()
  if (id) {
    // No id to doubt here, unlike the two writes either side of this one. The
    // form hands over the class and nothing else, and firestoreData names the
    // document after the class under whoever is signed in now, so even a form
    // filled in a moment earlier writes a row that belongs to this account.
    // Knowing which source it was filled in against would mean the component
    // passing that, which is a change to a signature every caller shares.
    await live.addClassMeeting(id, meeting)
  } else {
    // The same check the database makes, so the demo cannot reach a state a
    // real account could not. Without it the same course at the same time on
    // the same day lists twice, and the two rows differ only by an id nobody
    // can see.
    const already = classMeetings.some(
      (m) => m.course_code === meeting.course_code
        && m.day_of_week === meeting.day_of_week
        && m.start_time === meeting.start_time,
    )
    if (already) {
      throw new Error('That class is already on your schedule for that day and time.')
    }
    nextClassId += 1
    classMeetings = [
      ...classMeetings,
      { ...meeting, id: `cm-new-${nextClassId}`, profile_id: profile.id },
    ]
  }
  dataChanged()
}

// Every class the demo knows about is called cm-0, or cm-new-1 for one added
// inside it. An account's are named after the class, in capitals, so the id
// alone says which of the two sources a row was listed from.
function fromDemoSchedule(id: string) {
  return /^cm-(new-)?\d+$/.test(id)
}

const WRONG_SCHEDULE = 'That class belongs to a different account. Reload the page.'

export async function removeClassMeeting(id: string) {
  const account = accountId()
  // The schedule is a subcollection under the person, so deleting from it
  // needs to know whose it is. Postgres took the row id alone and let a
  // policy decide; here the path is the restriction.
  if (account) {
    // Whose row is this, for the reason saveProfile gives: the remount is
    // timing and this is the check. It matters more here than it does there,
    // because Firestore deletes a document that is not in the collection
    // without complaining and the rules allow it, so a row from the other
    // source comes back as a delete that worked on a schedule that still has
    // the class on it.
    if (fromDemoSchedule(id)) throw new Error(WRONG_SCHEDULE)
    await live.removeClassMeeting(account, id)
  } else {
    // The same both ways round. Filtering an array by an id that is not in it
    // is as quiet as the delete above, and an account's row is not the demo's
    // to remove.
    if (!fromDemoSchedule(id)) throw new Error(WRONG_SCHEDULE)
    classMeetings = classMeetings.filter((m) => m.id !== id)
  }
  dataChanged()
}

// The login card calls it a sample schedule, so leaving the demo has to make
// that true again. Without this the next person gets the last one's name,
// major and classes, which reads as a bug rather than as a demo everyone
// shares. Signing out of a real account does not come through here: those
// edits are in the database and are meant to still be there next time.
export async function resetDemoData() {
  profile = structuredClone(demoProfile)
  classMeetings = structuredClone(demoClassMeetings)
  nextClassId = 0
  dataChanged()
}
