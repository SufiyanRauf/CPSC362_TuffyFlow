// The one Firebase app, or null.
//
// Null is the normal state for anyone who clones the repository without making
// a project of their own, so every caller checks before using it. The app then
// runs on the rows bundled in campusData.ts and the login screen says why
// signing in is unavailable, rather than throwing on the first query.
//
// Auth is set up here and the database is not. firestoreData.ts fetches that
// half when something first asks for a row, because the login screen and the
// whole demo never touch it, and together the two halves are most of what the
// browser downloads.
//
// The config below belongs in the browser bundle. Firebase's own docs say so:
// none of it is a secret, it only names the project. What decides who may read
// what is the security rules in db/firestore.rules, which run on Google's side
// where nobody can edit them.

import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

type Connection = { app: FirebaseApp; auth: Auth }

function connect(): Connection | null {
  // All four, because three of them plus a blank one builds an app that fails
  // on the first request instead of saying it was never configured.
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    return null
  }
  try {
    const app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      appId: config.appId,
    })
    return { app, auth: getAuth(app) }
  } catch (e) {
    // Belt and braces, and worth being honest that it is: initializeApp does
    // not check any of the four values, so with the test above passing this
    // almost certainly never runs. A key that is wrong rather than missing
    // fails at the first request instead, which is why the login screen has
    // its own sentence for that.
    //
    // It stays because this file is imported from main.tsx, where anything
    // thrown is a blank page with no message at all.
    console.warn('Tuffy Flow: the Firebase config could not be used, so sign in is off.', e)
    return null
  }
}

const connection = connect()

export const firebaseApp = connection?.app ?? null
export const firebaseAuth = connection?.auth ?? null

// Both halves have to be there to be worth offering. There is no state where
// one works and the other does not.
export const signInAvailable = connection !== null
