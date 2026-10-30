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
import { accountId, accountName, draftKey } from './session'
import { dataChanged, dataVersion } from './dataVersion'
import * as live from './firestoreData'

// What the demo shows right now, which its own screens are allowed to change.
// Cloned out of the sample rows so that an edit here can never reach them.
let profile: Profile = structuredClone(demoProfile)
let classMeetings: ClassMeeting[] = structuredClone(demoClassMeetings)

// ---------------------------------------------------------------------------
// Reads
//
// Two sources, one set of names, for the reason the header of this file gives.
// What is worth adding here is how that went: eight of the eleven files that
// read through here changed, four for what accounts brought with them and four
// because a real query has timing a local array never had.
// ---------------------------------------------------------------------------

// The campus collections are the same five lists for everybody, and one screen
// load asks for them over and over: each panel runs its own loader and
// getRecommendations reads them again underneath, which was four reads of the
// seventeen buildings and three of the twelve lots to draw one dashboard.
// Firestore charges by the document read and the free tier is about 50,000 a
// day, so the page holds on to what came back.
//
// Two holds rather than one, because these collections do not all go stale at
// the same time, and treating them as if they did is what made a dashboard
// cost well over a hundred reads where eighty six would do. Eighty six is the
// dashboard counted out, each list read once: seventeen buildings, twelve
// lots, twenty four spots, twelve events, twenty class meetings and the one
// profile document.
//
// seeded() is for the five collections db/firestore.rules refuses every write
// to: buildings, parking_lots, spots, clubs and events. The seed script is the
// only thing that can ever change them, so they are keyed on who is asking and
// on nothing else, and they last the life of the page. That is the argument
// lotDocs() in firestoreData.ts already makes for the lots, applied to the
// other four, and it is what the second map below is worth paying for: keyed
// on dataVersion as well, setting a permit threw away three hundred and twenty
// clubs, so a student who set theirs and then added five classes, looking at
// Clubs in between, paid for those clubs six times over.
//
// once() is for the two that genuinely move, the profile and the schedule, and
// keeps dataVersion() in its key. That counter is already the app's signal
// that the rows behind a screen have moved on, so a save cannot be served the
// state that preceded it.
//
// Both are keyed on who is asking, because the demo and an account answer
// differently, and both key the whole set together rather than one key per
// list, which keeps either map from being something that only grows.
type Held = { key: string; reads: Map<string, Promise<unknown>> }

const seedOnly: Held = { key: '', reads: new Map() }
const perVersion: Held = { key: '', reads: new Map() }

// Null covers the demo and signed out, which read the same sample rows.
function asking() {
  return accountId() ?? 'sample'
}

function held<T>(into: Held, key: string, what: string, load: () => Promise<T>): Promise<T> {
  if (key !== into.key) {
    into.reads.clear()
    into.key = key
  }

  let pending = into.reads.get(what) as Promise<T> | undefined
  if (!pending) {
    // The promise, not the rows, so that the panels asking at the same moment
    // share one query instead of starting several.
    //
    // Dropping it on failure matters for the same reason firestoreData.ts
    // drops its SDK import: keeping a rejected promise means one bad read, off
    // campus wifi or a refused rule, keeps failing for the life of the page
    // even after the network comes back.
    pending = load().catch((e: unknown) => {
      into.reads.delete(what)
      throw e
    })
    into.reads.set(what, pending)
  }
  return pending
}

function seeded<T>(what: string, load: () => Promise<T>): Promise<T> {
  return held(seedOnly, asking(), what, load)
}

function once<T>(what: string, load: () => Promise<T>): Promise<T> {
  return held(perVersion, `${asking()}:${dataVersion()}`, what, load)
}

// Async because the database ones are. The sample rows never needed it.
export async function getBuildings(): Promise<Building[]> {
  return seeded('buildings', async () => (accountId() ? live.getBuildings() : buildings))
}
// Held here as well as by lotDocs() underneath, and the two cannot disagree:
// the twelve lots are the same twelve for every account, so the only thing
// this layer adds is skipping the strip of the availability map on every call.
export async function getParkingLots(): Promise<ParkingLot[]> {
  return seeded('lots', async () => (accountId() ? live.getParkingLots() : parkingLots))
}
export async function getSpots(): Promise<Spot[]> {
  return seeded('spots', async () => (accountId() ? live.getSpots() : spots))
}
export async function getClubs(): Promise<Club[]> {
  return seeded('clubs', async () => (accountId() ? live.getClubs() : clubs))
}
export async function getEvents(): Promise<CampusEvent[]> {
  // The sample rows hold a day offset, not a date, so they get dated here the
  // same way the Firestore ones do. Worked out per call rather than once at
  // import, so a tab left open overnight rolls over with the campus day. That
  // is also why the answer is not held above: the dates have to be worked out
  // again, and a kept answer would still be on yesterday in the morning.
  //
  // What can be held is the twelve documents the dates are worked out from,
  // and firestoreData's eventDocs() holds those for the life of the page, the
  // way lotDocs() beside it holds the lots. So the reads happen once and the
  // arithmetic happens every call, which is the half of this that has to. The
  // demo has nothing to hold: its rows are an array in campusRows.ts.
  return accountId() ? live.getEvents() : datedEvents(events)
}

// The two below are kept per data version rather than for the life of the
// page, because these are the rows a student can actually change. The write
// bumps the counter, the key moves with it, and the next read is the saved one.
export async function getProfile(): Promise<Profile> {
  // Three callers on one dashboard: the top bar, the greeting and the ranking
  // underneath it, which was three reads of one document.
  return once('profile', async () => {
    const id = accountId()
    // The name comes from the session rather than the database, because on a
    // brand new account there is no document yet and this is the call that
    // creates it. Firebase is the only thing that knows what to put on it.
    return id ? live.getOrCreateProfile(id, accountName()) : profile
  })
}

export async function getClassMeetings(): Promise<ClassMeeting[]> {
  // The dearest of the three, at twenty documents a read and three readers on
  // a dashboard: findNextClass, the ranking, and the schedule panel.
  return once('classes', async () => {
    const id = accountId()
    return id ? live.getClassMeetings(id) : classMeetings
  })
}

// Only the rows for the arrival hour and the hours either side of it, which is
// what the query filters on too.
//
// The one read here that is not held above, and deliberately: which rows come
// back depends on the day and hour asked for, so a hold keyed on who is asking
// would answer one hour's question with another hour's numbers. Little is lost
// by it either, because the twelve lot documents these numbers are sliced out
// of are held by lotDocs() in firestoreData.ts. The reads happen once for the
// life of the page and only the slicing runs again.
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
  // The three lines above only put back what the demo holds in memory, which
  // left a hole I walked into: the profile form keeps unsaved typing in
  // sessionStorage so a reload does not lose it, and the demo's key never
  // changes, so typing a name without saving and picking Leave demo handed
  // that name to the next person who opened the demo in the same tab. The key
  // comes from draftKey() in session.ts, which the profile form calls too, so
  // there is one spelling of it and the two ends cannot drift.
  //
  // Guarded the way both ends of the draft are guarded in the form: storage
  // throws outright in a private window, and failing to clear a draft is no
  // reason to fail leaving the demo.
  try {
    sessionStorage.removeItem(draftKey(demoProfile.id))
  } catch {
    // nothing to do about it, and nothing worth saying
  }
  dataChanged()
}
