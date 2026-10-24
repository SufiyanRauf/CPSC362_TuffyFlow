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
import { accountId, accountName } from './session'
import { dataChanged } from './dataVersion'
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

// Async because the database ones are. The sample rows never needed it.
export async function getBuildings(): Promise<Building[]> {
  return accountId() ? live.getBuildings() : buildings
}
export async function getParkingLots(): Promise<ParkingLot[]> {
  return accountId() ? live.getParkingLots() : parkingLots
}
export async function getSpots(): Promise<Spot[]> {
  return accountId() ? live.getSpots() : spots
}
export async function getClubs(): Promise<Club[]> {
  return accountId() ? live.getClubs() : clubs
}
export async function getEvents(): Promise<CampusEvent[]> {
  return accountId() ? live.getEvents() : events
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
  if (id) {
    // Whose form is this. The app remounts when the person changes, which is
    // what normally stops a stale form reaching the wrong account, but that
    // is mitigation by timing and this is the check. A form built for one
    // account cannot be written to another.
    if (next.id !== id) {
      throw new Error('That form belongs to a different account. Reload the page.')
    }
    await live.saveProfile(id, next)
  }
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

export async function removeClassMeeting(id: string) {
  const account = accountId()
  // The schedule is a subcollection under the person, so deleting from it
  // needs to know whose it is. Postgres took the row id alone and let a
  // policy decide; here the path is the restriction.
  if (account) await live.removeClassMeeting(account, id)
  else classMeetings = classMeetings.filter((m) => m.id !== id)
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
