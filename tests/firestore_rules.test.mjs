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
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc,
} from 'firebase/firestore'

const ALEX = 'alex-uid'
const JORDAN = 'jordan-uid'

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

  it('cannot be created already filled in', async () => {
    // Firebase has no free way to run code at signup, so the browser writes
    // this document. Pinning the shape is what stops it writing anything else.
    await env.clearFirestore?.()
    const filled = { ...freshProfile(), permit_type: 'employee', noise_pref: 5 }
    await assertFails(setDoc(doc(alex(), 'profiles', ALEX), filled))
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

  it('refuses a field nobody asked for', async () => {
    await assertFails(addDoc(mine(alex()), aClass({ junk: 'x'.repeat(1000) })))
  })
})
