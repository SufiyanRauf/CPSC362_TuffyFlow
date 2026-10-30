// The real queries, against the collections described in db/firestore.rules
// and loaded by db/seed_firestore.mjs.
//
// campusData.ts decides whether to call these or serve the sample rows, so
// everything here can assume there is a database and somebody signed in.
//
// Two things are shaped differently from the tables this used to be, and both
// are on purpose.
//
// Occupancy lives on the lot document rather than in rows of its own. As rows
// it is twelve lots times seven days times sixteen hours, which is 1,344
// documents, and Firestore charges by the document read. Folded into a map on
// each lot it is twelve reads for the same numbers.
//
// A building's name is copied onto every spot, and a club's name onto every
// event. Firestore has no joins, so the alternative is a second read per row
// to fetch a name. The seed writes both, which means the seed is the only
// place that can let them drift.

import type {
  Building, CampusEvent, ClassMeeting, Club, LotAvailability,
  ParkingLot, Permit, Profile, Spot, SpotHours, StoredEvent,
} from '../types'
import { datedEvents } from './eventDates'
import { firebaseApp } from './firebase'

// The Firestore half of the SDK is fetched the first time somebody asks for a
// row, not when the page loads. It is about half of everything the browser
// would otherwise download, and the login screen and the whole demo never
// touch it: only a signed in account does. Same reasoning as the map on the
// parking screen.
//
// The promise is kept rather than the result, so that several screens asking
// at once share one fetch instead of starting several.
let loading: Promise<typeof import('firebase/firestore')> | null = null

function sdk() {
  // Clearing it on failure matters. Keeping the rejected promise meant one
  // bad fetch, from a tunnel or a redeploy that renamed the chunk, poisoned
  // every read for the life of the page: the network could come back and
  // every screen would still fail until a reload.
  loading ??= import('firebase/firestore').catch((e) => {
    loading = null
    throw e
  })
  return loading
}

// Not reachable through campusData, which checks who is signed in first. It
// exists so that the calls below are not just taking it on trust.
async function connect() {
  if (!firebaseApp) throw new Error('Firebase is not configured')
  const fs = await sdk()
  return { fs, db: fs.getFirestore(firebaseApp) }
}

// An empty collection and a rule that refuses the read are not the same thing,
// but from here they look alike: Firestore answers a refused read with an
// error, and an unseeded one with nothing. Only the two collections nothing
// works without are guarded, and both come from the same seed run.
function demandRows<T>(what: string, rows: T[]) {
  if (rows.length === 0) {
    throw new Error(
      `No ${what} came back. Run db/seed_firestore.mjs, which loads the campus.`,
    )
  }
  return rows
}

// What a browser says when the request never got anywhere, in each browser's
// own words, plus what Firestore says when the rules turn a read down. The
// login screen already turns these into sentences; without the same thing here
// the identical outage would read properly before signing in and show "Failed
// to fetch" on every screen after it.
// The one sentence here written for whoever set the project up rather than for
// a student. It is a constant because studentFacing() below has to recognise
// it again to swap it out, and two copies of a sentence drift.
const RULES_REFUSED
  = 'The database would not allow that. Check that db/firestore.rules has been published.'

function readable(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ''
  if (code === 'permission-denied') {
    return RULES_REFUSED
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return 'Could not reach the server. Check your connection and try again.'
  }
  if (code === 'unauthenticated') {
    return 'You have been logged out. Log in again.'
  }
  if (code === 'not-found') {
    return 'That is not there any more. Reload the page.'
  }
  if (code === 'resource-exhausted') {
    // The free plan stops serving rather than billing, so this is a real
    // Saturday afternoon answer and not a theoretical one.
    return 'Tuffy Flow has hit its limit for today. It starts working again tomorrow.'
  }
  const message = error instanceof Error ? error.message : String(error)
  const m = message.toLowerCase()
  if (m.includes('failed to fetch') || m.includes('load failed')
      || m.includes('networkerror') || m.includes('fetch failed')) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  return message
}

// The sentences a student can actually do something about: the ones readable()
// writes above, the fetch failures in recommend.ts, and the three the app
// throws at a student itself when a form belongs to somebody else or a class
// is already on the schedule. Everything else that gets this far is written
// for whoever is building the app, a seed script to run or a rules file to
// publish, or it is the raw text of whatever the Firebase SDK threw, because
// readable() hands back the original message when it recognises nothing.
//
// So this is a list of what may be shown rather than a list of what may not.
// The app is deployed where anybody can open it, and a message nobody has
// thought about yet comes out generic that way instead of putting a shell
// command in front of a visitor.
const STUDENT_FACING = [
  'Could not reach the server.',
  'You have been logged out.',
  'That is not there any more.',
  'Tuffy Flow has hit its limit for today.',
  'That class is already on your schedule',
  'That class belongs to a different account.',
  'That form belongs to a different account.',
]

// What a student gets instead when nothing above matches. A panel said this
// already; the writes were saying nothing of the kind.
const GENERIC = 'Something went wrong on our end. Try again in a moment.'

// The one developer sentence that has a better student answer than the
// generic line. A refused rule and an App Check token that did not come
// through both arrive as permission-denied, so a deployed site really does
// reach this. "do that" rather than "save that" because this is shown by the
// panels too, and a read the rules turned down is not a save.
const NOT_ALLOWED = 'Your account is not allowed to do that right now. Try again in a moment.'

// Decided here rather than in Panel, where it started, because the panels were
// not the only thing showing these. The Profile screen prints what a failed
// save threw straight into its note, so the rules sentence, shell command and
// all, was one refused write away from a visitor's screen while the panels
// right next to it were careful about exactly that. One list, both callers,
// and it sits next to readable() so that rewording a sentence up there cannot
// quietly stop matching the list down here, which is what happened the first
// time the list was written out twice.
//
// The fallback is a parameter because a write knows what it was doing and can
// say so ("That class did not save."), while a panel only knows a read came
// back wrong.
//
// None of it applies while running locally, where the shell command is the
// whole point of the message.
export function studentFacing(message: string, fallback = GENERIC): string {
  if (import.meta.env.DEV && message) return message
  if (STUDENT_FACING.some((start) => message.startsWith(start))) return message
  if (message === RULES_REFUSED) return NOT_ALLOWED
  return fallback
}

async function readAll<T>(name: string): Promise<T[]> {
  try {
    const { fs, db } = await connect()
    const snapshot = await fs.getDocs(fs.collection(db, name))
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
  } catch (e) {
    throw new Error(readable(e))
  }
}

// Sorted here rather than by the query, because an orderBy that Firestore
// cannot serve from an existing index fails the read outright, and these are
// small enough that it makes no difference which end does it.
function byName<T extends { name: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name))
}

export async function getBuildings(): Promise<Building[]> {
  return demandRows('campus buildings', byName(await readAll<Building>('buildings')))
}

// The lot document carries its own week of occupancy, which the two functions
// below pull apart in the two shapes the app asks for.
type LotDoc = ParkingLot & { availability?: Record<string, Record<string, number>> }

// The collection itself, held for the life of the page, because the two
// functions below both need it and one screen asks for both: StructureFill
// fetches the lots and the occupancy together, and getRecommendations reads
// the lots in its first round and the occupancy in a second one that has to
// wait for the class time. Each of those was twelve documents charged twice
// for the same twelve documents.
//
// campusData's hold cannot cover this. It holds getParkingLots, but it
// deliberately does not hold the availability call, since which rows that
// returns depends on the hour asked for. This sits underneath both and is what
// the two have in common.
//
// Not keyed on anything, not even on who is asking, because these twelve are
// the same twelve for every account and nothing in the app ever writes to
// them: the seed is the only thing that puts them there. A profile write
// bumping dataVersion is no reason to pay for them again, which is the
// argument campusData's seeded() now makes for the other four collections.
//
// The promise rather than the rows, so two panels asking at the same moment
// share one query, and dropped on failure for the reason sdk() drops its
// import: a kept rejection would keep failing after the network came back.
let heldLots: Promise<LotDoc[]> | null = null

function lotDocs(): Promise<LotDoc[]> {
  heldLots ??= readAll<LotDoc>('parking_lots')
    .then((rows) => demandRows('parking lots', byName(rows)))
    .catch((e: unknown) => {
      heldLots = null
      throw e
    })
  return heldLots
}

export async function getParkingLots(): Promise<ParkingLot[]> {
  return (await lotDocs()).map(({ availability: _unused, ...lot }) => lot)
}

export async function getAvailabilityAround(
  day: number, hour: number,
): Promise<LotAvailability[]> {
  // The hour either side as well, which is what the sample data returns, so
  // the two sources answer the same question.
  const wanted = [hour - 1, hour, hour + 1]
  const rows: LotAvailability[] = []
  for (const lot of await lotDocs()) {
    const week = lot.availability?.[String(day)]
    if (!week) continue
    for (const at of wanted) {
      const pct = week[String(at)]
      if (pct === undefined) continue
      rows.push({ lot_id: lot.id, day_of_week: day, hour: at, typical_pct_full: pct })
    }
  }
  return rows
}

export async function getSpots(): Promise<Spot[]> {
  const rows = await readAll<Spot & { hours?: SpotHours }>('spots')
  // Firestore leaves a missing field undefined, and a document written before
  // hours existed has none. Without this the dashboard dies on
  // Object.keys(undefined), outside any catch, so the student gets a raw
  // TypeError instead of one of this app's sentences. An empty map is the
  // honest reading anyway: hours not known, which is not a reason to hide
  // anywhere.
  return byName(rows.map((spot) => ({ ...spot, hours: spot.hours ?? {} })))
}

export async function getClubs(): Promise<Club[]> {
  return byName(await readAll<Club>('clubs'))
}

// The stored rows, held for the life of the page for the same two reasons
// lotDocs() above holds the lots. One dashboard asks for the events twice, in
// the ranking and in the Upcoming panel, which was twenty four reads of the
// same twelve documents, and nothing in the app can write to this collection:
// db/firestore.rules refuses it, so a profile save bumping dataVersion is no
// reason to pay for them again.
//
// The rows and not the dated result, which is the part that matters. The dates
// are not stored, they are worked out per read, and a tab left open overnight
// has to roll over with the campus day. Holding what getEvents returns would
// leave the morning still showing yesterday.
//
// The promise rather than the rows, and dropped on failure, for the reasons
// lotDocs() gives.
let heldEvents: Promise<StoredEvent[]> | null = null

function eventDocs(): Promise<StoredEvent[]> {
  heldEvents ??= readAll<StoredEvent>('events').catch((e: unknown) => {
    heldEvents = null
    throw e
  })
  return heldEvents
}

export async function getEvents(): Promise<CampusEvent[]> {
  // What comes back has no date on it, only a day offset and a time, so a set
  // seeded weeks ago still reads as this week. datedEvents does the sorting
  // too, which Firestore cannot do for a field it is no longer storing.
  return datedEvents(await eventDocs())
}

// ---------------------------------------------------------------------------
// The student
// ---------------------------------------------------------------------------

// What a profile document holds before anybody has filled anything in. The
// four that stay null are the ones signing up cannot ask for, and leaving
// them null is what makes "not known" different from a guess. The rules
// insist on exactly this shape for a create, so a browser cannot write itself
// a profile that is already filled in.
// Only the six fields the document actually holds. The id is the name of the
// document, and a copy inside it is one more thing that can disagree with
// itself, which is what saveProfile says a few lines down and what this used
// to do anyway. The rules refuse a seventh field now, so the two cannot drift.
function emptyProfileFields(fullName: string | null) {
  return {
    full_name: fullName,
    major: null,
    interests: [] as string[],
    career_goals: [] as string[],
    permit_type: null,
    noise_pref: null,
  }
}

export async function getProfile(userId: string, fullName: string | null): Promise<Profile> {
  let fs, db, where, snapshot
  try {
    // connect() was outside this try, which meant a failed chunk fetch
    // reached the screen as "Failed to fetch dynamically imported module",
    // on every screen, because the top bar asks for the profile everywhere.
    ;({ fs, db } = await connect())
    where = fs.doc(db, 'profiles', userId)
    snapshot = await fs.getDoc(where)
  } catch (e) {
    throw new Error(readable(e))
  }

  if (!snapshot.exists()) {
    // Postgres had a trigger on the users table that wrote this row at signup.
    // Firebase can only do that with a Cloud Function, which needs a paid
    // plan, so the first look creates it instead. The rules allow a person to
    // create their own and nobody else's.
    const fresh = emptyProfileFields(fullName)
    try {
      await fs.setDoc(where, fresh)
    } catch (e) {
      throw new Error(readable(e))
    }
    return { id: userId, ...fresh }
  }

  const stored = snapshot.data()

  // Backfill the name, which signing up loses on its own.
  //
  // createUserWithEmailAndPassword tells every listener about the new account
  // before it returns, and at that moment Firebase has no name for them: the
  // name is set a moment later, by a second call. Four screens ask for the
  // profile the instant the session appears, so the document gets created in
  // that gap with nothing on it, and the student lands on a dashboard that
  // does not know who they are, permanently, because the document now exists.
  //
  // Writing it the moment we notice is what closes it. It costs one write,
  // once, for accounts made the long way round.
  if (stored.full_name == null && fullName) {
    try {
      await fs.updateDoc(where, { full_name: fullName })
      stored.full_name = fullName
    } catch {
      // not worth failing the whole screen over: the name is still on the
      // account, and the profile screen can set it by hand
    }
  }
  // Firestore leaves a missing field undefined rather than null, and the rest
  // of the app tests for null. Normalizing here keeps that one difference from
  // leaking into nine components.
  return {
    id: userId,
    full_name: (stored.full_name as string | null) ?? null,
    major: (stored.major as string | null) ?? null,
    interests: (stored.interests as string[]) ?? [],
    career_goals: (stored.career_goals as string[]) ?? [],
    permit_type: (stored.permit_type as Permit | null) ?? null,
    noise_pref: (stored.noise_pref as number | null) ?? null,
  }
}

export async function getClassMeetings(userId: string): Promise<ClassMeeting[]> {
  try {
    const { fs, db } = await connect()
    const snapshot = await fs.getDocs(
      fs.collection(db, 'profiles', userId, 'class_meetings'),
    )
    const rows = snapshot.docs.map((d) => ({
      id: d.id, profile_id: userId, ...d.data(),
    }) as ClassMeeting)
    return rows.sort(
      (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time),
    )
  } catch (e) {
    throw new Error(readable(e))
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function saveProfile(userId: string, next: Profile) {
  try {
    const { fs, db } = await connect()
    // id is left out on purpose: it is the name of the document, and a copy
    // inside it is one more thing that can disagree with itself.
    //
    // setDoc rather than updateDoc, and deliberately not merging. The rules
    // check the whole document after the write, and an update is merged with
    // whatever is already there, so a single stray field, added by hand in
    // the console or left behind by an older shape, fails hasOnly and refuses
    // every save that account ever makes again. Writing all six outright puts
    // a drifted document back instead of being blocked by it, and it cannot
    // fail with "not found" on a document the app is about to replace.
    await fs.setDoc(fs.doc(db, 'profiles', userId), {
      full_name: next.full_name,
      major: next.major,
      interests: next.interests,
      career_goals: next.career_goals,
      permit_type: next.permit_type,
      noise_pref: next.noise_pref,
    })
  } catch (e) {
    throw new Error(readable(e))
  }
}

// Two codes that differ only in punctuation or case land on the same id, so
// anything comparing codes has to agree with that or the duplicate guard has a
// hole in it.
function sameCourse(a: string, b: string) {
  const flat = (v: string) => v.replace(/[^A-Za-z0-9]+/g, '-').toUpperCase()
  return flat(a) === flat(b)
}

// Firestore ids cannot hold a slash and are easier to read without colons.
function meetingId(meeting: Omit<ClassMeeting, 'id' | 'profile_id'>) {
  return [
    meeting.course_code.replace(/[^A-Za-z0-9]+/g, '-'),
    meeting.day_of_week,
    meeting.start_time.replace(/:/g, ''),
  ].join('-')
}

export async function addClassMeeting(
  userId: string, meeting: Omit<ClassMeeting, 'id' | 'profile_id'>,
) {
  // Postgres refused a second copy of the same class itself, with a unique
  // constraint across the student, the course, the day and the start time.
  // Firestore has nothing of the kind, so the check is here, and the demo
  // makes the same one for the same reason.
  const already = (await getClassMeetings(userId)).some(
    // Compared the way the id is built, not raw. The id collapses punctuation,
    // so "CPSC-362" and "CPSC 362" at the same day and time are one document:
    // a raw comparison let the second past this guard and setDoc then replaced
    // the first, so the class looked like it had vanished rather than like a
    // refusal.
    (m) => sameCourse(m.course_code, meeting.course_code)
      && m.day_of_week === meeting.day_of_week
      && m.start_time === meeting.start_time,
  )
  if (already) {
    throw new Error('That class is already on your schedule for that day and time.')
  }
  try {
    const { fs, db } = await connect()
    // The id is built from the four things that made the class unique in
    // Postgres, so a second click writes the same document rather than a
    // second one. The check above is what produces a sentence; this is what
    // makes a duplicate impossible rather than unlikely.
    await fs.setDoc(
      fs.doc(db, 'profiles', userId, 'class_meetings', meetingId(meeting)),
      meeting,
    )
  } catch (e) {
    throw new Error(readable(e))
  }
}

export async function removeClassMeeting(userId: string, id: string) {
  try {
    const { fs, db } = await connect()
    await fs.deleteDoc(fs.doc(db, 'profiles', userId, 'class_meetings', id))
  } catch (e) {
    throw new Error(readable(e))
  }
}
