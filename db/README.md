# What is in here

The app runs on Firestore. Three files are live:

| File | What it is |
|---|---|
| `firestore.rules` | The access rules. Publish them with `firebase deploy --only firestore:rules`. This is the whole security model. Tested by `tests/firestore_rules.test.mjs`, which needs the Firebase CLI and a JDK for the emulator. |
| `seed_firestore.mjs` | Loads the campus into a project, with your own service account key. Nothing it writes expires, so one run is enough: events store a day offset, not a date. |
| `delete_account.mjs` | Erases one student, schedule included. Firebase cascades nothing, so without this a deleted account leaves its documents behind forever. |

`seed_firestore.mjs` needs Node 22.18 or newer, which reads the TypeScript
data file it imports without a build step. `delete_account.mjs` imports no
TypeScript and runs on anything.

The seed writes and never deletes, so a row removed from `campusRows.ts`
leaves its old document live in the app. Clear the collection by hand if that
ever comes up.

## The SQL files are the previous design

`schema.sql` and the five `seed_*.sql` files describe the Postgres database this
project was built on before it moved to Firestore. Nothing runs them any more.

They are kept rather than deleted for two reasons. They are where the campus
data was first written down, with its sources named row by row, and the README's
provenance table points at them. And they are the clearest record of how the
access rules were worked out, which is the part of this project worth being
able to explain: eight tables, twelve row level security policies, and a check
at the end of the file that refuses to pass if any of it did not run.

If you are reading those to understand the data, they are accurate. If you are
reading them to understand what the app talks to, read `firestore.rules`
instead.

## What moved, and what that cost

Postgres rows became Firestore documents one for one, with two exceptions.

Occupancy used to be its own table, twelve lots by seven days by sixteen hours,
which is 1,344 rows. Firestore charges per document read, so that shape would
have made every look at the parking screen 1,344 reads for twelve lots' worth
of numbers. It is folded onto the lot document instead, as day then hour then
percentage. Same numbers, twelve reads.

Joins do not exist, so the two names a screen reads across a relationship are
copied onto the row that wants them: a building's name onto every spot, a
club's name onto every event. The seed script writes both, which makes it the
only place they can drift apart.

Spot hours also changed shape, after the SQL was written. `seed_spots.sql` has
one `opens_at` and one `closes_at` per spot, which held the Monday to Thursday
hours and said nothing about the rest of the week. The live documents carry an
`hours` map keyed by day instead, because fifteen of the sixteen food places
are shut at the weekend and the old shape could not say so.

The check constraints have no Firestore equivalent, so the ones that mattered
are written as validation inside `firestore.rules`. The signup trigger has no
free equivalent either, because that needs a Cloud Function and a paid plan, so
the app creates a student's profile document the first time they sign in.
