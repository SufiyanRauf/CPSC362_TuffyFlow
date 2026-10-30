// What db/firestore.rules actually allows.
//
//   npm run test:rules
//
// Needs Java, because the Firestore emulator is a Java program. On a Mac:
// brew install --cask temurin. Without it the command fails saying so, and
// these never run.
//
// Why they exist: the rules are the whole security model, and until this file
// they had never been executed. The Postgres version they replaced ended with
// a block that refused to pass if any of it had not been applied. This is the
// equivalent, and it is stricter: it does not ask whether the rules are there,
// it asks what they do.
//
// Nothing here talks to a real project. The emulator is thrown away after.

import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc,
  updateDoc,
} from 'firebase/firestore'

const ALEX = 'alex-uid'
const JORDAN = 'jordan-uid'
// Nobody, with no profile document. Needed so that a create can be tested as
// a create: once Alex has one, the same write is an update, and update is
// allowed to carry the filled in values that create refuses.
const NEWCOMER = 'sam-uid'

// The create rule pins five fields to empty, and each pin is tested from a
// newcomer of its own. Sharing one uid would hide the hole being looked for:
// if a missing pin lets the first create through, the document it leaves
// behind turns every later write to that uid into an update, and update is
// allowed to carry these values, so the rest of the assertions would pass
// while proving nothing.
const PINNED_AT_CREATE = {
  major: NEWCOMER,
  permit_type: 'casey-uid',
  noise_pref: 'devon-uid',
  interests: 'harper-uid',
  career_goals: 'quinn-uid',
}

// What a brand new profile is, which is the only shape a create may have.
const freshProfile = (name = 'Alex Nguyen') => ({
  full_name: name,
  major: null,
  interests: [],
  career_goals: [],
  permit_type: null,
  noise_pref: null,
})

const aClass = (over = {}) => ({
  course_code: 'CPSC 362',
  day_of_week: 1,
  start_time: '11:30:00',
  end_time: '12:45:00',
  building_id: 'b-cs',
  ...over,
})

let env

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'tuffyflow-rules',
    firestore: {
      rules: readFileSync(new URL('../db/firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
  // The campus is seeded the way the real seed does it, with the Admin SDK,
  // which is the one thing allowed to write these.
  await env.withSecurityRulesDisabled(async (admin) => {
    const db = admin.firestore()
    await setDoc(doc(db, 'buildings', 'b-cs'), { name: 'Computer Science', code: 'CS' })
    await setDoc(doc(db, 'parking_lots', 'lot-nps'), { name: 'Nutwood Parking Structure' })
    await setDoc(doc(db, 'spots', 'spot-1'), { name: 'Library North 3rd Floor' })
    await setDoc(doc(db, 'clubs', 'club-1'), { name: 'ACM' })
    await setDoc(doc(db, 'events', 'event-1'), { title: 'Resume Workshop' })
    await setDoc(doc(db, 'profiles', JORDAN), freshProfile('Jordan Reyes'))
    await setDoc(doc(db, 'profiles', JORDAN, 'class_meetings', 'secret'), aClass())
  })
})

after(async () => { await env?.cleanup() })

const alex = () => env.authenticatedContext(ALEX).firestore()
const newcomer = (uid) => env.authenticatedContext(uid).firestore()
const strangers = () => env.unauthenticatedContext().firestore()
// request.auth is not null for an anonymous sign in either, which is one
// console toggle away from being switched on.
const anonymous = () => env
  .authenticatedContext('anon-uid', { firebase: { sign_in_provider: 'anonymous' } })
  .firestore()

describe('a logged out visitor', () => {
  it('cannot read the campus', async () => {
    const db = strangers()
    await assertFails(getDocs(collection(db, 'buildings')))
    await assertFails(getDocs(collection(db, 'clubs')))
    await assertFails(getDoc(doc(db, 'spots', 'spot-1')))
  })

  it('cannot read anybody’s profile', async () => {
    await assertFails(getDoc(doc(strangers(), 'profiles', JORDAN)))
  })
})

describe('an anonymous sign in', () => {
  it('counts as nobody, so the campus stays shut', async () => {
    await assertFails(getDocs(collection(anonymous(), 'clubs')))
  })
})

describe('a signed in student', () => {
  it('can read the campus', async () => {
    const db = alex()
    await assertSucceeds(getDocs(collection(db, 'buildings')))
    await assertSucceeds(getDocs(collection(db, 'parking_lots')))
    await assertSucceeds(getDocs(collection(db, 'spots')))
    await assertSucceeds(getDocs(collection(db, 'clubs')))
    await assertSucceeds(getDocs(collection(db, 'events')))
  })

  it('cannot change the campus', async () => {
    const db = alex()
    await assertFails(setDoc(doc(db, 'buildings', 'invented'), { name: 'Nowhere' }))
    await assertFails(updateDoc(doc(db, 'clubs', 'club-1'), { name: 'Renamed' }))
    await assertFails(deleteDoc(doc(db, 'events', 'event-1')))
    // All five, not three. parking_lots and spots carry the same
    // "allow write: if false" and were the two nobody was writing to, so
    // loosening either of them would not have turned anything red.
    await assertFails(setDoc(doc(db, 'parking_lots', 'invented'), { name: 'Nowhere' }))
    await assertFails(setDoc(doc(db, 'spots', 'invented'), { name: 'Nowhere' }))
  })
})

describe('one student against another', () => {
  it('cannot read the other’s profile', async () => {
    await assertFails(getDoc(doc(alex(), 'profiles', JORDAN)))
  })

  it('cannot list everybody’s profiles', async () => {
    await assertFails(getDocs(collection(alex(), 'profiles')))
  })

  it('cannot write the other’s profile', async () => {
    await assertFails(updateDoc(doc(alex(), 'profiles', JORDAN), { major: 'Changed' }))
    await assertFails(setDoc(doc(alex(), 'profiles', JORDAN), freshProfile('Impostor')))
    await assertFails(deleteDoc(doc(alex(), 'profiles', JORDAN)))
  })

  // Jordan already has a profile, so every write in the test above is an
  // update and it is the update rule that refuses them. That left the create
  // rule's own ownership check unexercised: changing it to plain signedIn()
  // kept all thirty one tests green, and it would have let anybody claim a
  // profile at the uid of somebody who had not signed in yet, with a name of
  // their choosing. This needs a uid with nothing at it.
  it('cannot create a profile at somebody else’s uid', async () => {
    await assertFails(setDoc(doc(alex(), 'profiles', 'river-uid'), freshProfile('Impostor')))
  })

  it('cannot read or touch the other’s schedule', async () => {
    const db = alex()
    const theirs = collection(db, 'profiles', JORDAN, 'class_meetings')
    await assertFails(getDocs(theirs))
    await assertFails(addDoc(theirs, aClass()))
    await assertFails(deleteDoc(doc(db, 'profiles', JORDAN, 'class_meetings', 'secret')))
  })
})

describe('a student’s own profile', () => {
  it('can be created, but only empty', async () => {
    await assertSucceeds(setDoc(doc(alex(), 'profiles', ALEX), freshProfile()))
  })

  it('cannot be created with any one of the five fields already filled in', async () => {
    // Firebase has no free way to run code at signup, so the browser writes
    // this document. Pinning the shape is what stops it writing anything else.
    //
    // Somebody with no profile yet, rather than Alex, who has one by now. The
    // same write against an existing document is an update, and update does
    // allow these values. This used to clear the whole database to get a
    // clean create, which left every test below it asserting against nothing.
    //
    // One field per write, and five writes, because a create carrying two
    // filled fields is refused as long as either pin survives: the version of
    // this test that set permit_type and noise_pref together let the major,
    // interests and career_goals pins be deleted without failing.
    const filled = {
      major: 'Computer Science',
      permit_type: 'employee',
      noise_pref: 5,
      interests: ['ai'],
      career_goals: ['research'],
    }
    for (const [field, uid] of Object.entries(PINNED_AT_CREATE)) {
      await assertFails(setDoc(doc(newcomer(uid), 'profiles', uid), {
        ...freshProfile('New Student'), [field]: filled[field],
      }))
    }
  })

  it('cannot carry a field nobody asked for', async () => {
    await assertFails(setDoc(doc(alex(), 'profiles', ALEX), {
      ...freshProfile(), payload: 'x'.repeat(1000),
    }))
  })

  it('can be updated with sensible values', async () => {
    const db = alex()
    await assertSucceeds(setDoc(doc(db, 'profiles', ALEX), freshProfile()))
    await assertSucceeds(updateDoc(doc(db, 'profiles', ALEX), {
      major: 'Computer Science', permit_type: 'student', noise_pref: 2,
      interests: ['ai'], career_goals: [], full_name: 'Alex Nguyen',
    }))
  })

  it('refuses a permit that is not one of the four', async () => {
    await assertFails(updateDoc(doc(alex(), 'profiles', ALEX), { permit_type: 'faculty' }))
  })

  // Counting the tags was never enough. hasOnly refuses a seventh field and
  // says nothing about what is inside an allowed one, so one interest of a
  // million characters used to sail through and park it on the document.
  //
  // Every position, not only the first two. Rules cannot loop, so someTags
  // writes the same check out twelve times by hand, and this suite used to put
  // a bad tag at index 0 and index 1 only. That left ten of those twelve lines
  // unexecuted: any one of them could be deleted, or carry a typo in the index
  // it reads, and nothing here would fail. The hole that opens is exactly the
  // megabyte on a profile those lines exist to refuse.
  it('refuses a bad tag at any of the twelve positions', async () => {
    const db = alex()
    const clean = Array.from({ length: 12 }, (_, i) => `tag-${i}`)
    // Twelve clean tags are allowed, so the only thing that can refuse these
    // writes is the per position check on the one element that was spoiled.
    const spoiled = ['x'.repeat(5000), 'y'.repeat(33), 7, '', null, { nested: 'map' }]

    for (let i = 0; i < clean.length; i += 1) {
      for (const bad of spoiled) {
        const tags = [...clean]
        tags[i] = bad
        await assertFails(updateDoc(doc(db, 'profiles', ALEX), { interests: tags }))
        await assertFails(updateDoc(doc(db, 'profiles', ALEX), { career_goals: tags }))
      }
    }
  })

  it('refuses tags that are not a list at all', async () => {
    const db = alex()
    await assertFails(updateDoc(doc(db, 'profiles', ALEX), { interests: 'ai' }))
    await assertFails(updateDoc(doc(db, 'profiles', ALEX), { career_goals: 5 }))
  })

  it('refuses more tags than the profile screen can make', async () => {
    const thirteen = Array.from({ length: 13 }, (_, i) => `tag-${i}`)
    await assertFails(updateDoc(doc(alex(), 'profiles', ALEX), { interests: thirteen }))
    await assertSucceeds(updateDoc(doc(alex(), 'profiles', ALEX), { interests: thirteen.slice(0, 12) }))
  })

  it('refuses a name or a major longer than the rule allows', async () => {
    const db = alex()
    await assertFails(updateDoc(doc(db, 'profiles', ALEX), { full_name: 'n'.repeat(201) }))
    await assertFails(updateDoc(doc(db, 'profiles', ALEX), { major: 'm'.repeat(201) }))
  })

  // hasAll is the half of the pair that stops a field going missing, and
  // removing one is the only way to get there from a browser.
  //
  // All six, because deleting major on its own said nothing about the other
  // five. Worth knowing while reading this: each validator call in aProfile
  // reads its own key, and reading a key that is not there is an error, which
  // Firestore turns into a deny, so these six writes are refused twice over.
  // That makes hasAll belt and braces rather than the only thing standing in
  // the way, and it is why no client side test can prove hasAll by itself.
  it('refuses an update that removes any of the six fields', async () => {
    const db = alex()
    const fields = [
      'full_name', 'major', 'interests', 'career_goals', 'permit_type', 'noise_pref',
    ]
    for (const field of fields) {
      await assertFails(updateDoc(doc(db, 'profiles', ALEX), { [field]: deleteField() }))
    }
  })

  it('refuses a noise level outside one to five', async () => {
    const db = alex()
    await assertFails(updateDoc(doc(db, 'profiles', ALEX), { noise_pref: 0 }))
    await assertFails(updateDoc(doc(db, 'profiles', ALEX), { noise_pref: 9 }))
  })

  it('can be deleted, because somebody has to be able to leave', async () => {
    await assertSucceeds(deleteDoc(doc(alex(), 'profiles', ALEX)))
  })
})

describe('a student’s own schedule', () => {
  const mine = (db) => collection(db, 'profiles', ALEX, 'class_meetings')

  it('takes a sensible class', async () => {
    await assertSucceeds(addDoc(mine(alex()), aClass()))
  })

  it('can be read back and cleared', async () => {
    const db = alex()
    await assertSucceeds(getDocs(mine(db)))
    await assertSucceeds(setDoc(doc(db, 'profiles', ALEX, 'class_meetings', 'x'), aClass()))
    await assertSucceeds(deleteDoc(doc(db, 'profiles', ALEX, 'class_meetings', 'x')))
  })

  it('lets the owner fetch one meeting on its own', async () => {
    const ref = await addDoc(mine(alex()), aClass({ course_code: 'CPSC 349' }))
    await assertSucceeds(getDoc(doc(alex(), 'profiles', ALEX, 'class_meetings', ref.id)))
  })

  // Two strings only compare as two times while both are the same length, so
  // a mixed pair used to let a class of no length through.
  it('refuses a time without seconds, so the end > start test stays honest', async () => {
    await assertFails(addDoc(mine(alex()), aClass({ start_time: '09:30', end_time: '09:30:00' })))
    await assertFails(addDoc(mine(alex()), aClass({ end_time: '12:45' })))
  })

  it('refuses a time that is not a time', async () => {
    await assertFails(addDoc(mine(alex()), aClass({ start_time: '9:00' })))
    await assertFails(addDoc(mine(alex()), aClass({ end_time: 'banana' })))
    await assertFails(addDoc(mine(alex()), aClass({ start_time: '24:00:00' })))
  })

  it('refuses a class that ends before it starts', async () => {
    await assertFails(addDoc(mine(alex()), aClass({ end_time: '09:00:00' })))
  })

  it('refuses a day outside the week', async () => {
    await assertFails(addDoc(mine(alex()), aClass({ day_of_week: 7 })))
    await assertFails(addDoc(mine(alex()), aClass({ day_of_week: -1 })))
  })

  it('refuses a class with no course code or no building', async () => {
    await assertFails(addDoc(mine(alex()), aClass({ course_code: '' })))
    await assertFails(addDoc(mine(alex()), aClass({ building_id: '' })))
  })

  // The other end of those two length checks. Only the empty string was ever
  // tried, so the caps themselves were never executed: 32 could be raised to
  // 3200 and 64 to 6400 and the suite stayed green, which is the long field
  // the cap is there to keep off a document. One character over each, because
  // a cap tested a mile past its limit does not say where the limit is.
  it('refuses a course code or a building id one character over the cap', async () => {
    const db = alex()
    await assertFails(addDoc(mine(db), aClass({ course_code: 'C'.repeat(33) })))
    await assertFails(addDoc(mine(db), aClass({ building_id: 'b'.repeat(65) })))
  })

  it('refuses a field nobody asked for', async () => {
    await assertFails(addDoc(mine(alex()), aClass({ junk: 'x'.repeat(1000) })))
  })
})
