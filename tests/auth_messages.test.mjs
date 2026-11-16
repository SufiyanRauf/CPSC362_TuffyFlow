// Whether what the auth code says ever reaches the person reading the screen.
//
// Two files have to agree for that to happen. session.ts turns a Firebase
// error code into a sentence, and firestoreData.ts keeps the list of sentences
// allowed through to a panel; anything not on it is replaced by a generic
// line. The agreement was by hand, and it had already slipped: the sentence
// for picking the wrong Google account in the delete flow was written, was
// reachable, and was being swallowed, so the student was told "try again"
// with no hint of what was wrong.
//
// These read both files rather than importing them, because session.ts only
// runs with a Firebase app configured and plainly() is private to it. A new
// branch in plainly() now has to be classified as one or the other, or this
// fails and says which sentence nobody decided about.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8')
const session = read('../src/lib/session.ts')
const data = read('../src/lib/firestoreData.ts')

// Sentences that only ever appear on the login card, which renders what it is
// given instead of asking firestoreData. Every one of these is about signing
// in or signing up, or tells the reader to use View demo, none of which means
// anything inside a panel on the profile screen, so the generic line is the
// right answer if one ever arrives there.
//
// Listed by hand on purpose: the point of the test is that a new sentence
// cannot arrive without somebody deciding which of the two it is.
const LOGIN_CARD_ONLY = [
  'There is already an account with that email. Log in instead.',
  'Passwords need at least 6 characters.',
  "That doesn't look like an email address.",
  // the provider is switched off in the Firebase console, which is not
  // something a student can do anything about
  'That way of signing in is not available yet.',
  'Logging in is not set up for this web address. Use View demo for now.',
  'Logging in is not working right now. Use View demo for now.',
  "That didn't work. Try again, or use View demo.",
]

function quotedStrings(source) {
  // 'a', "a", and the escaped apostrophe inside either
  const found = []
  const pattern = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g
  for (const m of source.matchAll(pattern)) {
    found.push((m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'))
  }
  return found
}

// Only what plainly() actually hands back. Taking every string literal in the
// body caught the code it matches on and the console prefix next to it too.
function sentences() {
  const at = session.indexOf('function plainly(')
  assert.ok(at > 0, 'could not find plainly() in src/lib/session.ts')
  const rest = session.slice(at)
  const end = rest.indexOf('\n}\n')
  assert.ok(end > 0, 'could not find the end of plainly()')
  const body = rest.slice(0, end)

  const said = []
  const pattern = /return\s+('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g
  for (const m of body.matchAll(pattern)) {
    said.push(m[1].slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"'))
  }
  return said
}

function studentFacing() {
  const at = data.indexOf('const STUDENT_FACING = [')
  assert.ok(at > 0, 'could not find STUDENT_FACING in src/lib/firestoreData.ts')
  const rest = data.slice(at)
  return quotedStrings(rest.slice(0, rest.indexOf(']')))
}

test('every sentence the auth code can say is either allowed through or listed', () => {
  const allowed = studentFacing()
  assert.ok(allowed.length > 5, 'the allowed list came back too short to be real')

  const said = sentences()
  assert.ok(said.length >= 12, `only found ${said.length} sentences in plainly()`)

  // All of them, rather than stopping at the first, so one run says how much
  // there is to decide.
  const undecided = said.filter((sentence) => (
    !allowed.some((prefix) => sentence.startsWith(prefix))
    && !LOGIN_CARD_ONLY.includes(sentence)
  ))

  assert.deepEqual(undecided, [],
    'nobody decided where these go. Add each to STUDENT_FACING in '
    + 'src/lib/firestoreData.ts if a panel can show it, or to LOGIN_CARD_ONLY '
    + 'in this test if only the login card can.')
})

test('the list of login card sentences has nothing stale on it', () => {
  // A reworded sentence would otherwise sit here forever, claiming a decision
  // about something that is no longer said anywhere.
  const said = sentences()
  for (const sentence of LOGIN_CARD_ONLY) {
    assert.ok(said.includes(sentence),
      `LOGIN_CARD_ONLY still lists ${JSON.stringify(sentence)}, which plainly() `
      + 'no longer says. Remove it.')
  }
})

test('the half way messages say which half, and are allowed through', () => {
  // Both of them start with a prefix on the allowed list, because a student
  // told "your account was not deleted" after their schedule has gone has
  // been told something untrue.
  const allowed = studentFacing()
  const campus = read('../src/lib/campusData.ts')

  for (const half of [
    'Your profile and schedule were erased',
    'Some of your account was erased',
  ]) {
    assert.ok(allowed.some((prefix) => half.startsWith(prefix)),
      `${half} is not allowed through to the screen`)
  }

  // and the one that reports the account itself surviving carries the reason
  assert.match(campus, /but the account itself is still/,
    'campusData no longer reports the account surviving the row delete')
  assert.match(campus, /\+ gone\.message/,
    'the reason removeSignIn gave is being dropped again')
})

test('nothing may write an account that is being erased', () => {
  // The guard that stops Save changes putting the profile back while the
  // delete is in flight. Three writers and the one read that creates.
  const campus = read('../src/lib/campusData.ts')
  const guards = campus.match(/=== leaving\) throw new Error\(LEAVING\)/g) ?? []
  assert.equal(guards.length, 3,
    'the three writers in campusData.ts no longer all check the leaving guard')
  assert.match(campus, /live\.getOrCreateProfile\(id, accountName\(\), \(\) => id !== leaving\)/,
    'getOrCreateProfile may create a profile for an account being erased')
  // A predicate and not a boolean, because the answer is wanted after the
  // read rather than from before it. The read is long enough for the delete
  // to have started since, and a boolean settled beforehand says yes anyway.
  assert.match(data, /if \(!mayCreate\(\)\) return \{ id: userId, \.\.\.fresh \}/,
    'getOrCreateProfile is deciding whether it may create before its own read')
  // And the guard has to end with the sign in it belongs to. Held past one,
  // it refuses every save by a student whose account is still there.
  assert.match(campus, /subscribeToSession\(\(\) => \{\s*\n\s*if \(leaving && accountId\(\) !== leaving\) leaving = null/,
    'the leaving guard can now outlive the session that set it')
})

test('the schedule is paged until it comes back empty', () => {
  // A single listing misses a row written after it, and that row outlives the
  // profile it hangs under with nothing able to reach it. The admin script
  // loops; this one has to as well.
  assert.match(data, /fs\.query\(schedule, fs\.limit\(PAGE\)\)/,
    'eraseStudent no longer pages the schedule')
  assert.match(data, /if \(page\.empty\) \{\s*\n\s*emptied = true/,
    'eraseStudent no longer stops on an empty page, so it cannot be looping')
  // Twenty passes is eight thousand classes, so this is near unreachable. It
  // matters because the way out of it used to be the profile delete, which
  // abandons every row the loop never got to: the exact outcome the paging is
  // here to avoid, arrived at by running out of road.
  assert.match(data, /if \(!emptied\) throw new Error/,
    'running out of passes deletes the profile over the rows that are left')
})

test('the delete is announced before the sign out, not after', () => {
  // deleteUser signs the client out itself, so the listener fires and the
  // login card mounts while removeSignIn is still waiting. The card reads the
  // flag on the way up. Written afterwards, it announced nothing and then sat
  // in sessionStorage waiting to congratulate the next login card in the tab.
  const campus = read('../src/lib/campusData.ts')
  const set = campus.indexOf("sessionStorage.setItem(DELETED, '1')")
  const out = campus.indexOf('const gone = await removeSignIn()')
  assert.ok(set > 0, 'campusData no longer leaves the word for the login card')
  assert.ok(out > 0, 'campusData no longer ends the session')
  assert.ok(set < out,
    'the delete is announced after the sign out, so the login card misses it')
  // And taken back if the sign out is the step that failed.
  assert.match(campus, /sessionStorage\.removeItem\(DELETED\)/,
    'a delete that did not finish still announces itself as done')
})

test('the half way guard and the sentence it reads agree', () => {
  // campusData decides whether to hold the leaving guard by reading the front
  // of the error firestoreData throws. That is two files agreeing by hand, the
  // same coupling STUDENT_FACING has, and the same way of catching it: if
  // somebody rewords the sentence, the guard silently stops matching and a
  // live panel can write a profile back while the student is being told to
  // press Delete account again.
  const campus = read('../src/lib/campusData.ts')
  const guard = campus.match(/const PART_ERASED = '([^']+)'/)
  assert.ok(guard, 'campusData no longer names the half way sentence')
  // Matched on the tail, not the head. Matching the head found the copy of
  // the sentence sitting in STUDENT_FACING instead of the one that is thrown,
  // so rewording the throw alone left this passing against the allowlist.
  const thrown = data.match(/'([^']*but the rest is still here[^']*)'/)
  assert.ok(thrown, 'firestoreData no longer throws a half way sentence')
  assert.ok(thrown[1].startsWith(guard[1]),
    `the guard looks for ${guard[1]} and the throw says ${thrown[1]}`)
  // And it is only cleared when nothing was erased.
  assert.match(campus, /if \(!halfWay\) leaving = null/,
    'the leaving guard is being cleared on a half way erase again')
})
