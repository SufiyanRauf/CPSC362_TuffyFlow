// Who is using the app, and how to become them.
//
// Three answers, not two. Signed in is one, signed out is another, and the
// demo is a third: it reads the sample rows in campusData.ts and writes
// nowhere, so the app can be shown without an account and without a database.
// Keeping it in the same place as the real session is what stops the rest of
// the app asking "is this a demo" in twenty different ways.
//
// A module store rather than a React context, to match the data layer next to
// it. The store exists whether or not anything is rendering, which is what
// lets campusData.ts ask who is signed in without being a component.

import { useSyncExternalStore } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { firebaseAuth } from './firebase'
import { dataChanged } from './dataVersion'

// Not exported. Nothing outside this file names the type: components read it
// through useSession() and let TypeScript infer, and the data layer asks the
// two narrow questions further down instead.
type Session =
  // asking Firebase whether a session is already stored in this browser
  | { kind: 'loading' }
  | { kind: 'out' }
  | { kind: 'demo' }
  | { kind: 'account'; userId: string; email: string; fullName: string | null }

// With no project there is nothing to ask, so skip the spinner entirely.
let current: Session = firebaseAuth ? { kind: 'loading' } : { kind: 'out' }
const listeners = new Set<() => void>()

// Set when somebody asks to sign out, cleared the next time Firebase reports a
// user. signOut below drops the local session without waiting for the network,
// on purpose, so if Firebase's own sign out throws then currentUser can outlive
// it. leaveDemo reads currentUser to decide where to go, which means a sign out
// that failed, followed by View demo and Leave demo, would hand the browser
// back the account the person had just left without asking them for anything.
// Signed out is the one state nothing should be able to undo by accident.
let signedOutOnPurpose = false

function set(next: Session) {
  current = next
  for (const listener of listeners) listener()
  // signing in or out swaps the source of every row on every screen
  dataChanged()
}

// The two halves useSyncExternalStore wants. Neither is exported, because the
// hook that uses them is right below. dataVersion.ts has to export its pair
// for the opposite reason: the hook reading it lives in another file.
function subscribeToSession(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function sessionSnapshot() {
  return current
}

export function useSession() {
  return useSyncExternalStore(subscribeToSession, sessionSnapshot, sessionSnapshot)
}

// What the data layer asks. Null covers signed out, the demo and still
// loading, which all mean the same thing to a query: do not run one.
export function accountId(): string | null {
  return current.kind === 'account' ? current.userId : null
}

// The name Firebase has for this person, which is what goes on a new profile
// document the first time they sign in. Google supplies it; the signup form
// writes it with updateProfile.
export function accountName(): string | null {
  return current.kind === 'account' ? current.fullName : null
}

// Where the profile form keeps typing that has not been saved yet, so a reload
// does not throw it away.
//
// Keyed on whose profile it is, so a draft typed in the demo can never be put
// back into a real account's form. That is the same hazard saveProfile checks
// for, and a draft outliving a sign in is one more way to reach it.
//
// A function here rather than the string written out in each place that needs
// it. Two places do: the profile form, which saves and clears the draft, and
// resetDemoData in campusData.ts, which has to clear the demo's draft when
// somebody leaves the demo. Spelled out twice they can drift, and the way they
// would drift is silent, because clearing a key nothing is stored under looks
// exactly like clearing the right one. It lives in this file because what it
// belongs to is the session: the draft lasts as long as the tab, and which
// draft it is depends on who is using the app.
export function draftKey(id: string) {
  return `tuffyflow:profile-draft:${id}`
}

// Fires once on subscribe with whatever is in storage, which is also how the
// first answer arrives, and again on every later change. Firebase keeps auth
// state in step across tabs, so a sign in somewhere else shows up here too.
if (firebaseAuth) {
  onAuthStateChanged(firebaseAuth, (user) => {
    if (!user) {
      // Firebase has no idea the demo exists and reports nobody for it, so
      // without the first test its very first callback throws you out of the
      // demo you just opened. The second is because this fires on the way
      // past "out" as well, and announcing a change that is not one costs a
      // reload of every screen.
      if (current.kind !== 'demo' && current.kind !== 'out') set({ kind: 'out' })
      return
    }
    // Somebody has signed in, which is the only thing that makes currentUser
    // worth trusting again. This sits above the demo check rather than below
    // it because a sign in that happened somewhere else is still a sign in:
    // the tab stays in the demo, but leaving it now has somewhere to go.
    signedOutOnPurpose = false
    // Opened in another tab and signed in there? A tab somebody is browsing
    // the demo in should stay in the demo rather than being pulled into an
    // account mid page.
    if (current.kind === 'demo') return

    const email = user.email ?? ''
    const fullName = user.displayName ?? null
    // Refreshing a token comes through here too, carrying the same person it
    // did an hour ago. Building a new state object for that would tell every
    // screen its rows had changed and set off a reload of all of them for
    // nothing.
    if (current.kind === 'account' && current.userId === user.uid
        && current.email === email && current.fullName === fullName) {
      return
    }
    set({ kind: 'account', userId: user.uid, email, fullName })
  })

  // Nothing bounds how long that first answer takes. Firebase reads its
  // stored session out of IndexedDB and will wait on a network that is never
  // going to reply, which on campus wifi behind a sign in page means a student
  // reading "Checking whether you're logged in" with no way to reach View
  // demo. After this the app gives up and shows the login screen. A session
  // that does turn up later still signs them in.
  const FIRST_ANSWER_MS = 6000
  setTimeout(() => {
    if (current.kind === 'loading') set({ kind: 'out' })
  }, FIRST_ANSWER_MS)
}

export function enterDemo() {
  set({ kind: 'demo' })
}

// Not async. There is nothing here to wait for: leaving the demo asks Firebase
// what it already has in memory and sets the session, the way enterDemo above
// does. It said async for a while and the promise it handed back was one more
// thing for a caller to wonder about.
export function leaveDemo() {
  // The demo is not an account, so leaving it is not signing out of anything.
  // Ending the Firebase session here would be reaching into somebody else's
  // tab: Firebase keeps one session per browser, and the reason this tab is
  // in the demo at all is that it refused to follow a sign in that happened
  // somewhere else.
  //
  // So it asks who, if anyone, this browser is signed in as, and goes there.
  // That also answers the other way in: the first check can time out into the
  // login screen, somebody picks View demo, and the session turns up after.
  //
  // Unless a sign out is what put this browser on the login screen in the
  // first place. currentUser can outlive a signOut whose network half failed,
  // and the demo is not a back door into an account somebody chose to leave.
  const user = signedOutOnPurpose ? null : (firebaseAuth?.currentUser ?? null)
  if (!user) {
    set({ kind: 'out' })
    return
  }
  set({
    kind: 'account',
    userId: user.uid,
    email: user.email ?? '',
    fullName: user.displayName ?? null,
  })
}

export async function signOut() {
  // Screen first. Whatever the network does, the person asked to leave, and
  // leaving them looking at their own data would be the wrong way to fail.
  // The flag goes with it, before the listeners run, because from here on
  // nothing may read its way back into this account on Firebase's word alone.
  signedOutOnPurpose = true
  set({ kind: 'out' })
  if (!firebaseAuth) return
  try {
    // Firebase signs out of this browser only, and clears its own stored
    // session before it returns, so there is nothing to tidy up by hand and
    // no way to end the session on somebody's phone. It does end it in every
    // other tab of this browser, which is what signing out should do.
    await firebaseSignOut(firebaseAuth)
  } catch {
    // It has already dropped the local session by this point. There is
    // nothing useful left to say and the screen is already on the login card.
    // What it cannot promise is that Firebase dropped its own, which is what
    // the flag above is for.
  }
}

// ---------------------------------------------------------------------------
// Getting in
//
// These report back instead of throwing, because every one of their failures
// is something the person has to read and act on, not an exception.
// ---------------------------------------------------------------------------

// Not exported either. The three calls below return it and the login screen
// reads ok and message off what comes back, so naming the type elsewhere has
// never been necessary.
type AuthResult =
  | { ok: true }
  | { ok: false; message: string }

export const NO_PROJECT = 'Accounts are not available right now. View demo to look around.'

// Firebase reports failures as a code on the error object. Matching the code
// rather than the message is what stops this breaking the first time Google
// rewords something.
function plainly(error: unknown) {
  const code = (error as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      // Firebase deliberately returns one code for all three now, so that a
      // stranger cannot find out which addresses have accounts. The wording
      // has to cover both without guessing.
      return "That email and password don't match an account."
    case 'auth/email-already-in-use':
      return 'There is already an account with that email. Log in instead.'
    case 'auth/weak-password':
      return 'Passwords need at least 6 characters.'
    case 'auth/invalid-email':
      return "That doesn't look like an email address."
    case 'auth/too-many-requests':
      return 'Too many tries. Give it a minute.'
    case 'auth/network-request-failed':
      return 'Could not reach the server. Check your connection and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'You closed the Google window, so nothing happened.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign in window. Allow popups for this site and try again.'
    case 'auth/operation-not-allowed':
      return 'That way of signing in is not available yet.'
    case 'auth/unauthorized-domain':
      return 'Logging in is not set up for this web address. Use View demo for now.'
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/invalid-api-key':
    case 'auth/configuration-not-found':
    case 'auth/app-deleted':
      // What a wrong or half pasted config gets you. Tried it against a
      // project that does not exist and the login screen printed
      // "Firebase: Error (auth/api-key-not-valid...)" at the student, which
      // is a sentence for whoever set the project up, not for them.
      return 'Logging in is not working right now. Use View demo for now.'
    default:
      // Anything unrecognized. Firebase writes these for a developer reading
      // a console, so the code goes there and the person gets a sentence.
      if (code) console.warn('Tuffy Flow: unhandled Firebase auth code', code, error)
      return "That didn't work. Try again, or use View demo."
  }
}

export async function signInWithGoogle(): Promise<AuthResult> {
  if (!firebaseAuth) return { ok: false, message: NO_PROJECT }
  try {
    // A popup rather than a redirect. The redirect version comes back through
    // the URL, and this app keeps the current screen in the URL hash, so the
    // two would have to be kept out of each other's way. A popup never
    // touches the address bar at all.
    await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
    return { ok: true }
  } catch (e) {
    return { ok: false, message: plainly(e) }
  }
}

export async function logIn(email: string, password: string): Promise<AuthResult> {
  if (!firebaseAuth) return { ok: false, message: NO_PROJECT }
  try {
    await signInWithEmailAndPassword(firebaseAuth, email, password)
    return { ok: true }
  } catch (e) {
    return { ok: false, message: plainly(e) }
  }
}

export async function signUp(
  email: string, password: string, fullName: string,
): Promise<AuthResult> {
  if (!firebaseAuth) return { ok: false, message: NO_PROJECT }
  try {
    const { user } = await createUserWithEmailAndPassword(firebaseAuth, email, password)
    // Firebase does not take a name at signup, so it goes on straight after.
    // The profile document reads it from here the first time the app looks
    // for one, which is why it has to be set before anything else runs.
    const named = fullName.trim()
    await updateProfile(user, { displayName: named })
    // onAuthStateChanged already fired, before the name existed, and it does
    // not fire again for a profile edit, so without this the session carries
    // a null name until the next reload.
    //
    // It does not stop the profile document being written with no name on it.
    // That happens in the gap above, while updateProfile is in flight, and by
    // the time this line runs the document already exists. firestoreData's
    // getOrCreateProfile fills the name in when it notices.
    if (current.kind === 'account' && current.userId === user.uid) {
      set({ ...current, fullName: named })
    }
    // Signed in already. Unlike some providers Firebase does not hold the
    // account back for an email confirmation, so there is nothing to send
    // anybody off to click. The login screen used to have a branch for that,
    // left over from when this was Supabase, which nothing could reach.
    return { ok: true }
  } catch (e) {
    return { ok: false, message: plainly(e) }
  }
}
