# What is in here

The app runs on Firestore. Three files are live:

| File | What it is |
|---|---|
| `firestore.rules` | The access rules. Publish them with `firebase deploy --only firestore:rules`. This is the whole security model. Tested by `tests/firestore_rules.test.mjs`, which needs the Firebase CLI and a JDK for the emulator. |
| `seed_firestore.mjs` | Loads the campus into a project, with your own service account key. Nothing it writes expires, so one run is enough: events store a day offset, not a date. A project last seeded before that change does need one run, because those documents hold a date and no offset. |
| `delete_account.mjs` | Erases one student, schedule included. Firebase cascades nothing, so without this a deleted account leaves its documents behind forever. |

`seed_firestore.mjs` needs Node 22.18 or newer, which reads the TypeScript
data file it imports without a build step. `delete_account.mjs` imports no
TypeScript and runs on anything.

The seed writes and never deletes, so a row removed from `campusRows.ts`
leaves its old document live in the app. Clear the collection by hand if that
ever comes up.

## The SQL files are the previous design

`schema.sql`, `seed.sql` and the four `seed_*.sql` files describe the Postgres database this
project was built on before it moved to Firestore. Nothing runs them any more.

They are kept rather than deleted for two reasons. They are where the campus
data was first written down, with its sources named row by row, and the README's
provenance table names the sources they cite. And they are the clearest
record of how the
access rules were worked out, which is the part of this project worth being
able to explain: eight tables, twelve row level security policies, and a check
at the end of the file that refuses to pass if any of it did not run.

If you are reading those to understand the data, they are accurate with four
exceptions, all of them in `src/lib/campusRows.ts`, which is the live copy.
Occupancy diverged four times: on 2026-10-30 when Friday got its own curve, on
2026-11-03 when weekday evenings got theirs, and twice more when readings taken
on 4 and 5 November and on 8 November replaced parts of the curve with measured
figures, which are `WEEKDAY_MEASURED` and `WEEKEND_MEASURED` in that file.
Together they change 660 of the 1,344 cells and remove another 112 outright.
This paragraph named only the first two until the cells were counted one at a
time against the live rows: those two account for 388 of the 660. Eastside South closed, so it
carries no row at any hour of any day rather than the evening-only gap this
paragraph used to describe. The SQL files still give it the highest weekday
offset of any lot and still explain that it fills because it is closest to the
academic buildings, which is the one place they are most misleading. Ten
clubs' interest tags were revised after `seed_clubs.sql` was written. And the
demo account's interests read `algorithms` here and `robotics` live, which
matters because no club carries `algorithms`. If you are
reading them to understand what the app talks to, read `firestore.rules`
instead.

## What moved, and what that cost

Postgres rows became Firestore documents nearly one for one. Six columns did
not make the trip and nothing stores or reads them now: `clubs.description`,
which is most of the bulk of `seed_clubs.sql`, plus `clubs.status`,
`spots.source_url`, `profiles.created_at` and `events.lat`/`events.lng`. The
two shape changes below are the ones that were decisions rather than drops.

Occupancy used to be its own table, twelve lots by seven days by sixteen hours,
which is 1,344 rows, of which 1,232 survive the closure of Eastside South.
Firestore charges per document read, so that shape would have made every look
at the parking screen 1,232 reads for twelve lots' worth
of numbers. It is folded onto the lot document instead, as day then hour then
percentage. Twelve reads instead of 1,232.

The live grid is 1,232 rather than 1,344, and the 112 missing cells are
deliberate: Eastside South is closed, so it writes no row at any hour of any
day and is filtered out before the ranking rather than shown with a stand-in.

Joins do not exist, so the two names a screen reads across a relationship are
copied onto the row that wants them: a building's name onto every spot, a
club's name onto every event. Both are written out beside the row they belong
to in `src/lib/campusRows.ts`, and the seed script copies them across without
touching them, so that file is the only place they can drift apart.

Spot hours also changed shape, after the SQL was written. `seed_spots.sql` has
one `opens_at` and one `closes_at` per spot, which held the Monday to Thursday
hours and said nothing about the rest of the week. The live documents carry an
`hours` map keyed by day instead, because fifteen of the sixteen food places
are shut at the weekend and the old shape could not say so.

The check constraints have no Firestore equivalent, so the ones that mattered
are written as validation inside `firestore.rules`. The signup trigger has no
free equivalent either, because that needs a Cloud Function and a paid plan, so
the app creates a student's profile document the first time they sign in.
