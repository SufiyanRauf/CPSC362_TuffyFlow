// Erase one student completely.
//
//   node db/delete_account.mjs path/to/serviceAccountKey.json <email>
//
// Postgres did this without being asked. The profile row hung off auth.users
// with "on delete cascade" and the schedule hung off the profile the same way,
// so removing the account took all of it. Firebase cascades nothing, and a
// document's subcollections outlive the document, so without this a withdrawn
// student's whole week of whereabouts would sit in the database at a path
// nobody could reach.
//
// Order matters. The schedule goes first, because once the profile document is
// gone its subcollection is still there and is harder to find.

import { readFileSync } from 'node:fs'
import { argv, exit } from 'node:process'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const [, , keyPath, email] = argv
if (!keyPath || !email) {
  console.error('Usage: node db/delete_account.mjs path/to/serviceAccountKey.json <email>')
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
const auth = getAuth()

async function main() {
  let user
  try {
    user = await auth.getUserByEmail(email)
  } catch {
    console.error(`No account with the email ${email} in project ${key.project_id}`)
    exit(1)
  }

  console.log(`Deleting ${email} (${user.uid}) from ${key.project_id}`)

  const schedule = db.collection('profiles').doc(user.uid).collection('class_meetings')
  let removed = 0
  // In pages, because a batch takes 500 and somebody could in principle have
  // more class meetings than that.
  for (;;) {
    const page = await schedule.limit(400).get()
    if (page.empty) break
    const batch = db.batch()
    for (const row of page.docs) batch.delete(row.ref)
    await batch.commit()
    removed += page.size
  }
  console.log(`  class meetings removed: ${removed}`)

  await db.collection('profiles').doc(user.uid).delete()
  console.log('  profile document removed')

  await auth.deleteUser(user.uid)
  console.log('  sign in account removed')
  console.log('\nDone. Nothing of theirs is left.')
}

main().catch((e) => {
  console.error('\nDeleting failed, and it may have stopped part way through.')
  console.error(e.message)
  exit(1)
})
