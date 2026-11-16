# Decisions

Running notes on why things are the way they are. Mostly so we can answer
"why did you do it that way" without trying to remember six weeks later.

---

**2026-09-20: TypeScript, not JavaScript**

The README said JavaScript and the presentation said TypeScript. Went with
TypeScript because that is what we presented, and because having the shape of
our database rows written down catches a lot of mistakes before the code runs.
Costs us some time up front.

---

**2026-09-20: Vercel only, dropped GitHub Pages**

GitHub Pages only serves static files. Our scoring endpoint is a Python
function, so it cannot run there at all. Vercel serves the React app and runs
the Python function from the same repo.

---

**2026-09-20: No router**

> Reversed on 9 October: there is a router now, in the URL hash. The entry
> for it is further down.

Five screens and one user. Using one piece of state for the active view and
showing the matching component does the same job. A router would also need
extra config on Vercel so that refreshing a page does not 404, and the catch
all rule it needs can swallow requests meant for our Python endpoint.

If we ever want links people can share, we can revisit this.

---

**2026-09-20: One ranking engine, three configurations**

Parking, study spots and events looked like three features. They are the same
thing: throw out the candidates that are impossible, score the rest on a few
factors, sort, explain the top few. So we are writing one `rank()` function and
giving it different filters, factors and weights for each feature.

Less code, and the distance math and sorting only get written once.

---

**2026-09-20: Rule based scoring, not machine learning**

We have no real usage data, so a model would be learning from numbers we made
up. It also could not explain its own output, and every card in this app has to
say why it was picked. A weighted average of factors we chose is the right
answer here, not a worse one.

---

**2026-09-20: Every factor scaled to 0 to 1 before weighting**

Walking minutes go up to 20 and fullness goes up to 100. If we add the
raw numbers, fullness decides basically everything no matter what weights we
pick. Scaling first means a weight of 0.5 actually means half the decision.

We scale against fixed numbers we picked (best is a 2 minute walk, worst is 20)
rather than against the best and worst in that day's list. Scaling against the
list makes the top result read as 100% every single time.

---

**2026-10-11: Walks are measured from the right day now**

Every distance in the app was measured from the building of your next class.
That is correct for parking, because the next class is the whole reason you are
parking, and it is wrong for everything else.

On a Friday afternoon your next class is Monday morning. So a study spot across
the road from where you were actually sitting was scored on how far it is from
Monday's lecture hall, and a Saturday event was measured the same way. The
numbers were not wrong arithmetic, they were answering a question nobody asked.

Each day is looked at on its own now: the anchor is the class nearest in time
that day, and only if it is within three hours. Spots use today, events use the
day the event is on, parking still uses the next class.

When nothing anchors a day, the walk simply does not get a vote. The first
version of this picked the middle of campus instead, which was worse than it
sounds: it is a real coordinate, so it produced a confident ranking, and what
it actually ranked was whatever happened to sit nearest the arithmetic center
of the campus. On a Sunday that put Pollak Library top at a hundred percent
for no reason anyone could defend. Now the walk scores a flat half, the other
factors decide, and the card says nothing at all about the walk rather than
explaining an absence nobody asked about.

The three hour cap is the same argument. A class that ended at 10:15 does not
say where someone is at seven in the evening, and guessing with a building name
attached is worse than admitting the gap.

This needed the class schedule to carry its buildings, not just its times, so
class_meetings now sends lat, lng and the building name. It was already sending
every meeting for the clash check, so nothing new goes over the wire per class
beyond the location.

---

**2026-10-09: Rebuilt the parking lots after finding the data was stale**

Someone asked a simple question: does the Directions button go to the right
place? Checking it properly turned up something worse than a bad link. CSUF
renamed every lot in summer 2025 and numbered them against the campus
entrances, E for employee, S for student, R for resident. The campus map's
locations.json has not caught up, and that file is where we built the lots
from, so we had a list of names that no longer exist sitting on top of
coordinates that were still fine.

Three things were actually wrong, not just out of date. The two Eastside
structures were swapped, so the app sent you to the north one when it said
south. S8 and S10 were in the list as their own lot and also as Lot A and Lot
G, which are the same two places under their old names, so the same parking was
offered twice and the capacity was overcounted. And the Visitor Lot did not
exist at all: CSUF has no visitor lot, visitors buy an hourly permit and use an
hourly zone, so that row was a lot we had invented.

The lots now come from the parking map at parking.fullerton.edu, which is the
sheet that actually names them, and capacity is null wherever CSUF does not
publish one.

The permit column became an array in the same pass. It had to: the structures
take student, employee and visitor permits at the same time, and a single value
per lot cannot say that. It is one line in the scorer, `permit in lot.permits`
rather than `==`.

---

**2026-09-20: Permit type is a filter, not a scoring factor**

If it were a factor, an employee lot that happened to be empty and close could
outrank every lot we are actually allowed to park in, and the app would tell a
student to park somewhere they would get ticketed. Impossible options get
removed before anything is scored.

---

**2026-09-20: The scoring service does not touch the database**

The browser already read the rows, as the signed in student, with the database
deciding what they are allowed to see. It sends those rows to the Python
function instead of the function fetching them itself.

If the Python side queried the database it would need its own credentials, and
the credential that lets a server read anything ignores all of our access
rules. That would be sitting in settings on a repo three of us push to.

Downside: we trust the browser to send real rows. Fine here, because the
service does not write anything. It works out a suggestion and hands it back to
the same person who asked.

---

**2026-09-20: Two TypeScript checks turned off**

`noUnusedLocals` and `noUnusedParameters` are off in tsconfig.app.json. They
fail the build on half finished code that runs fine locally, which costs time
and does not catch anything we care about. Everything else in strict mode stays
on.

**Reversed on 2026-10-30, see below.**

---

**2026-10-30: Friday gets its own parking curve**

The occupancy model had one weekday shape, fitted to the Thursday readings, and
it reproduces those exactly. A Friday reading off the board at 11:51 showed it
was 81 points wrong: it said Eastside North was 99 percent full when the board
said 18, and the order of the lots inverts: Eastside North is the busiest
structure at 13:57 on the Thursday, and the emptiest on the Friday. Far fewer
classes run
here on a Friday. So the seed carried three shapes from here rather than two,
and a fourth followed on 2026-11-03 when evenings got their own. Friday
lands exactly on its reading.

Honest limit: Friday rests on one reading at one hour, so its midday level is
measured and the rest of its day is not. The parking footnote says so.

This is also why `src/lib/campusRows.ts` no longer mirrors `db/seed.sql`: that
file is the previous Postgres design, nothing runs it, and it has no Friday
branch.

---

**2026-11-03: Weekday evenings get their own parking curve**

The same thing happened again, at the other end of the day. Every reading the
model was fitted to is a midday one: 13:11 and 13:57 on a Thursday, 11:51 on a
Friday, 12:23 on a Sunday. Nothing measured an evening, and the README said so.

A Tuesday reading at 18:14 showed the weekday curve treats 18:00 as the tail of
the midday hump and has the campus nearly emptied by then. It predicted 5, 1,
41, 43 and 20 percent for the five counted facilities; the board said 42.3,
51.8, 54.0, 1.5 and 53.8. Mean error 35 points.

Eastside South is the part that matters. It is the fullest structure of the
weekday afternoon, 88 percent at 13:11, and the curve carried that forward and
called it the fullest at 18:00 too. The board had it at 1.5 percent: twenty
cars in 1341 spaces, the emptiest thing on campus. A base that is 35 points low
can be shifted; an ordering that inverts cannot, which is exactly the argument
Friday settled. So evening carries its own per lot offsets, and Monday to
Thursday from 17:00 uses them.

A second Tuesday reading at 18:46, taken after the curve had been fitted to the
18:14 one, was the check that it is not just repeating its own input: every lot
came back within 4.2 points of that first fit. The fit is now centred on the
pair rather than on either one. Four lots emptied across the half hour, which
is the direction the evening decay assumes.

**Eastside South is deliberately left out of the evening, and that is the part
worth reading.** Both readings put it at 1.49 percent, twenty cars in 1341
spaces, and it is the only facility that did not change at all between them:
190 cars left campus in those 32 minutes and none of them left Eastside South.
At the same moment 1016 drivers were sitting in Eastside North with 864 spaces
free, next door to a structure that was all but empty and a shorter walk to the
academic core. Nobody queues for the fuller one. So the board was not recording
low evening demand. It was recording a structure that was not taking cars.

Writing that in as a demand offset is what the first version of this change
did, and it made the app rank Eastside South the best evening parking on campus
four days a week, at one to four percent full, with the shortest leave-by
buffer of any lot. That is advice to drive to a gate that may be shut. There is
no evening row for it now, so lot_fullness falls back to the stand-in and the
card says "no typical reading for that hour", which is the truth. One evening
reading taken on a day it is plainly open would settle it.

Against the 3 point per lot bar the Thursday pair set, every lot in all six
readings is now within 2.72 points, and that worst case is the pre-existing
Thursday 13:57 one rather than anything the evening added. (Superseded by the
5 November refit: nine readings, seven of them fitted, worst case 2.11 on
Eastside North at 18:46 on the Tuesday, and the 1 October pair deliberately
40-odd points out.) The four earlier
readings are untouched, because the evening branch only applies from 17:00 on
Monday to Thursday.

Honest limit, and it is a real one: both evening readings are the same hour, so
18:00 is the only measured level. 19:00 to 21:00 is an assumed decay, and a
uniform one, which the readings argue against, since Eastside North drained
about four times faster than S8 and S10 over the same half hour. 17:00 is a
blend of the afternoon and evening levels rather than a reading. Only a Tuesday
was sampled, so Monday, Wednesday and Thursday inherit a Tuesday. Friday
evening deliberately keeps the Friday shape, because the single Friday reading
is a midday one and says nothing about a Friday night. The parking footnote on
the screen says the evening rests on two readings half an hour apart.

---

**2026-11-05: Phillip's readings, and what was taken from them**

Phillip collected thirteen readings covering September to November, several at
hours this project has never measured. Most of it is not in the seed, and the
reason is worth writing down because it is a judgement rather than a rule.

Twelve of the thirteen are recovered from indexed captures of
parking.fullerton.edu/parkinglotcounts. The project is not allowed to scrape,
and while there is a real difference between an app fetching a page at runtime
and a teammate reading historical captures, the difference is not one I can
settle on the team's behalf. Every reading in data/parking_samples.csv is a
photograph of the public board, and keeping that true is worth more than four
extra rows.

Two of his rows also fail a check, which matters for how much weight the rest
carries. His September readings put Nutwood between 95 and 100 percent full
from 11:06 to 14:21 on the 23rd. The board photograph from 1 October has it at
49.6 percent at 13:11. Both are ordinary mid-semester weekdays and they cannot
both be describing normal operation. Separately, his 5 November 13:32 row
agrees with our own 13:35 photograph to within three spaces on four of five
lots, and then gives S8 and S10 as 972 against our 911 -- 61 spaces in three
minutes, and exactly the S8 and S10 figure from 3 November 18:14.

Two things were taken.

The first is the Eastside South closure, which his sheet confirms from a
source that is not our camera. His five November rows and our four give nine
observations between 3 November 18:14 and 5 November 13:35, spanning 10:07 to
20:45, and every one of them reads 1321 free. His own sheet raises the counter
being stale; that is the same conclusion by another name, and either way
nothing is parking there. A finding that survives two independent sources is
worth more than one that rests on four photographs from one person.

The second is an out of sample check, which is the most useful thing in the
file. The curve was fitted to our readings and not to his, so his four
November rows are a free test of it. It comes out at a mean of 2.7 points at
10:07 and 5.0 at 10:56, which validates the morning ramp -- the part that is
assumed rather than measured, and the part I was least sure of. It comes out
at 8.3 at 15:15 and 9.0 at 20:45, with Nutwood 16 points low in the afternoon
and S8 and S10 22 points low late in the evening.

So the curve has a known bias, in the two places it already said were
assumptions, and it has not been corrected. Fitting to data the project is not
allowed to use, in order to quietly improve a number, would trade something
that matters for something that does not. The bias is recorded instead, here
and in the samples file. Two more photographs, one about 15:00 and one about
20:00, would fix it with figures nobody can question.

---

**2026-11-15: The second review found the first review's own mistakes**

The account work was read again, by three passes that were told what the
first round had already fixed and asked what it missed. What came back was
mostly about the fixes themselves, which is the useful answer.

The confirmation on the login card never appeared. The flag it reads was
written after `deleteMyAccount` returned, and by then there was nobody left to
read it: `deleteUser` signs the client out itself, so the listener fires and
App swaps in the login card while `removeSignIn` is still waiting. The card
reads the flag as it mounts, which is already past. Worse than silence, the
flag then stayed in sessionStorage, waiting to tell whoever next landed on
that card in the same tab that their account had been deleted. It is written
before the sign out now, and taken back if that step is the one that failed.
The irony is the point: the same ordering bug was fixed three functions away
in `removeSignIn`, with a comment explaining it, in the same commit.

`eraseStudent` paged the schedule until the listing came back empty, bounded
at twenty passes so a page that would not go away could not spin. Running out
of passes fell through to the profile delete, which abandons every row the
loop never reached. That is the exact outcome the paging exists to prevent,
reached by running out of road. It stops now and reports the half instead.

The `leaving` guard outlived its own sign in. It was cleared only if the erase
failed outright, so after the half-way state a student who signed out and back
in, which is what the message tells them to do, found every save refused with
"your account is being deleted" until they reloaded. It is cleared the moment
the session stops being that account. Either the delete finished, and that uid
cannot sign in again, or it did not, and the account is real and writing to it
is right.

Two smaller ones. The profile-creation guard was a boolean settled before the
read it guards, so a read already in flight still wrote; it is a predicate
asked afterwards. And a wrong password on the delete screen said "that email
and password don't match an account", on a form with no email box, because it
borrowed the login card's wording for a code Firebase uses for both.

The rules suite had eight tests that could not fail. They update Alex's
profile, the only thing creating it was the first test in the block, and the
last test in the block deletes it: run with `--test-name-pattern`, or
reordered, and every `assertFails` was refused for the document being missing
rather than for the rule under test. Proved by deleting the permit rule and
running one of them alone, which passed before and fails now. Alex is put back
before each test with the Admin SDK, and the create test moved to a uid of its
own, since the same write against an existing document is an update and proves
nothing about creating.

Nothing of Bhavy's was changed. All thirty two replaced lines were mine, from
the previous round's fixes, which is where the defects were.

---

**2026-11-14: What the review of the account work found**

Password reset and in-app account deletion came in on 11 November as one
commit of 445 lines, and it was read afterwards across four separate passes:
the delete path and the rules, the session state machine, the three screens,
and the documents. The code was careful and most of it stood. Four things did
not, and they are worth writing down because three of them were comments that
described something the code did not do, which is the failure this project is
most likely to repeat.

The profile could come back after it was deleted. deleteMyAccount deliberately
does not call dataChanged() between its steps, and the comment explaining that
was right about why: it would send every panel back for the profile, and
getOrCreateProfile writes one when it finds none. What it missed is that not
calling it is not the same as nobody calling it. Details and Week sit on the
same screen with their own busy flags, so Save changes and Add class stay live
while the delete runs, and both of those call dataChanged() themselves. The
end state was a profile owned by an account that can never sign in again:
every rule on it keys on the owner being signed in, so no student and no
screen could ever read it or delete it, and only the admin key could clear it
up. There is a leaving guard in campusData.ts now. The three writers refuse
while it is set and the read is told not to create.

The schedule had the same hole from the other direction. eraseStudent listed
the schedule once and deleted what the listing held, so a class added in
between was still there when the profile above it went. db/delete_account.mjs
had this right already and loops until the listing comes back empty; the
in-app one does now too.

A student could be told their account was not deleted after their schedule had
gone. The erase has two places it can stop half way, and only one of them said
so. Both name the half that happened now, and the reason removeSignIn gave is
carried through instead of dropped, because "too many tries" and "log back in"
are the half that says what to do next and "press the button again" is the one
thing that makes the first of those worse.

The reset card was an account oracle whenever Firebase's Email Enumeration
Protection was off. The comment said it reports the same thing either way
"because Firebase does", and Firebase only does that when a console setting
says so, which is not code and is not in the setup steps. Green for an address
with an account and red for one without is exactly what the wording was
written to prevent. resetPassword answers the user-not-found case itself now,
so the promise lives in the code.

Also: the flag that stops View demo handing back an account you have just left
was being set after the delete rather than before it, which is the opposite of
what its own comment said and of what signOut does; Google now wins over a
password when an account carries both, because a federated proof is one the
person can always complete and a password on that address may be one they
never chose; and re-authentication fails in words rather than opening a Google
window for an account that does not sign in with Google.

The sentence for picking the wrong Google account was written, was reachable,
and was being swallowed, because it never went on the list of sentences
allowed through to a panel. That list and the sentences are in two different
files and agreed by hand. tests/auth_messages.test.mjs reads both and fails if
a sentence is written but cannot reach the screen, and it found a second one
nobody had classified on its first run. Two more rules cases went in as well,
for the two things the one new case could not see: a batch is refused at its
first denied write, so putting both deletes in one batch never reached the
profile rule at all, and the capability a second press of the button actually
needs is deleting a class meeting that has outlived the profile above it.

Not changed, and recorded so nobody has to find it twice. The leaving guard is
in memory, so a reload inside the half-way state loses it and the next read
recreates the profile; pressing the button again is what closes that, which is
what the message asks for. The three steps' order and the guard itself are
checked by reading the source rather than by calling anything, which is weaker
than a real test and is said as much in TEST_CASES.md. And the screens are
still checked by hand, because there is no component harness here and adding
one for this would be a new runner and a new dependency for logic that should
not have been in a component in the first place.

---

**2026-11-08: The profile screen's rules came out of the component**

Everything in this project that could be tested without a browser had been
moved into src/lib or api/ already, and TEST_CASES.md said so in a sentence
that was not quite true: "what is left in the components is layout and
wiring". It was not. ProfileView.tsx is the largest file here and the only
one with no test of its own, and three pieces of real logic were still in it.

Two of those had to agree with db/firestore.rules, and the only thing holding
them in step was a comment saying "kept in step by hand". That is the kind of
promise that holds right up until it does not, and the failure is not subtle:
change the cap in the rules and a student typing a thirteenth interest reads
a security rules error instead of a sentence.

So the interest slug, the two tag ceilings and the class time validation are
now in src/lib/profileEdits.ts, the same move clubRanking.ts made out of
ClubsView.tsx and for the same reason, which is that node --test can import a
.ts from src/lib but not a .tsx component. Seven cases cover them, and two of
those read db/firestore.rules and parse the numbers out of it rather than
repeating them, so the client and the database now drift apart in a test run
instead of in front of somebody using the app.

Rejected adding a component harness, vitest and testing-library, to test the
screen as a screen. It is the more complete answer and it is probably right
eventually, but it is a new dependency and a new runner for logic that did
not need to be in a component in the first place. Moving the logic is the
cheaper fix and it leaves less behind.

What is still untested in that file, and is now named in TEST_CASES.md rather
than covered by a sentence that was too broad: the session storage draft
recovery, and every screen as a screen.

The same pass fixed four passages that could be read but not defended. The
20 in recommend.ts that picks which occupancy hour to read is
BASE_PARKING_BUFFER_MINUTES plus the largest surcharge arrive_by can add, so
it is the earliest the scorer can ever name once the walk is taken out; the
walk is deliberately not in it, because a per lot arrival hour would need the
fullness of the hour it is trying to find. The 17:00 handoff in campusRows.ts
is a mean of the two hours either side, each from the branch that owns it,
and is now parenthesised to read as one rather than as four terms over two.
The 9 in soon_factor is one day past the furthest event the seed carries.
And the two ?? defaults in weekdayLevel cannot fire at a 6 to 21 grid, which
they now say.

---

**2026-11-08: The weekend was read a second time, and mostly held**

The weekend curve rested on one Sunday reading at 12:23 on 20 September. A
second one, 21:40 on Sunday 8 November, is the first time any day in this
model has been read again at a different hour after being fitted, so it is the
closest thing the project has to a proper held out test rather than a check
done thirty minutes later.

Three of the four open lots came back without needing anything. Nutwood 1.93
to 1.77 percent, State College 4.01 to 3.35, Eastside North 0.48 to 0.90,
which went up. Nine hours apart, seven weeks apart, against a model predicting
1, 2 and 1. A weekend genuinely is flat for the structures, and the flat level
they already carried was right.

S8 and S10 was eleven points out: 45.58 percent against a predicted 57. So the
weekend now carries a measured level for that pair at the two hours that were
read, 59 at noon and 46 at 21:00, with a straight line between them, and
nothing else about the weekend changed. Rejected sliding the whole weekend
base down in the evening, because that would have dragged three lots that were
measured flat in order to fix one that was not, which is the same mistake the
shared weekday base made.

Honest limits, and they are the same three as before. The line between noon
and nine is straight because two points cannot describe a curve, and inventing
one from a single pair is exactly what produced the first, overfitted evening
shape. Nothing before noon has ever been read on a weekend, so those hours
hold the midday level rather than running the line backwards, which would
claim S8 and S10 is fuller at seven on a Sunday morning than at lunchtime.
And only Sundays have been sampled, so Saturday still inherits a Sunday.

One thing worth noticing across both tables now that there are two weekend
hours. S8 and S10 has been read below 45 percent exactly once, 41.44 at 11:51 on the Friday,
while the structures empty to 1. Roughly a thousand cars sit in those two lots
whatever the time, which is the residence halls, and it is the same fact that
makes the pair fall 4 points between 13:00 and 18:00 on a weekday while
Nutwood falls 51, Eastside North 38 and State College 36. The model now says that in two places instead
of fighting it in one.

Eastside South read 1321 free for the tenth time, three days after the ninth,
at night, on a weekend, and from this camera rather than Phillip's sheet.
Nothing has moved in there in the five days from 3 to 8 November. The screen
footnote and the test comment say five readings across four days: the other
five were from the spreadsheet this project does not draw on, and citing them
put harvested figures behind a conclusion that does not need them.

---

**2026-11-05: Monday to Thursday is measured per lot now, not one shared curve**

Yesterday's entry ended by saying a second weekday midday reading would settle
whether to refit. It arrived: Thursday 13:35, at a different hour from the
Wednesday one, so the two together give a shape rather than a point.

They also showed the old arrangement could not hold the answer. A shared base
with a per lot offset forces every lot onto the same curve at different
heights, and the readings are not that. Between 13:00 and 18:00 Nutwood falls 51 points, Eastside North 38 and State College 36, while S8 and S10 drops 4. S8 and S10
sits by the stadium and the gym, which stay open in the evening, and the model
had no way to say so: it was carrying a uniform decay that was roughly twice
too fast for that lot and roughly right for the others.

So Monday to Thursday now carries a measured level per lot at three hours,
11:00, 13:00 and 18:00, with the hours between them interpolated. Rejected
keeping the shared base and adding a fourth offset column, which would have
been a fifth variation on a shape the data had already refused twice.

What that cost, stated plainly. The four November readings now reproduce to
within 2.11 points, and the two middays to within half a point. The two
Thursday readings from 1 October are forty two and forty six points out, and
they are supposed to be: Eastside South was the fullest structure on campus
that afternoon, it closed a month later, and its thirteen hundred spaces of
demand are in the other three now. A curve that still matched both Octobers
and both Novembers would be describing two different campuses at once. Those
two readings are named in the test file's NOT_FITTED list with that reason,
and a test fails if they ever start matching, so the exemption cannot quietly
outlive it.

Honest limits, and there are three. The morning ramp and the last three hours
of the evening are fractions of each lot's own measured level, not readings;
only 11:00, 13:00 and 18:00 are real. Friday and the weekend still rest on
readings taken before the closure and will be describing a quieter campus than
the one outside, which the parking footnote now says. And only Tuesday,
Wednesday and Thursday were sampled, so Monday inherits them.

---

**2026-11-04: Eastside South is closed, and the curve is behind because of it**

A midday Wednesday reading settled two things the evening pair had only
hinted at.

Eastside South read exactly 1321 free for the third time, on a different day
and at a different time of day. The first two were Tuesday evening. This one is
11:59 on a Wednesday, with Nutwood at 95.9 percent, Eastside North at 90.9 and
State College at 90.5. Nobody leaves 1321 spaces empty next to a structure that
full. It was the fullest thing on campus at 13:11 on 1 October, at 87.9 percent,
though Eastside North passed it by 13:57. By 30 October it was third at 35.6,
behind Nutwood at 45.7 and S8 and S10 at 41.4. It closed somewhere between 30
October and 3 November.

Yesterday it lost its evening rows. That was not enough. With no rows at all it
fell back on the unknown stand in, which is 50 percent, and at a busy hour that
beats every structure that is genuinely almost full, so the closed structure
came back as the **top** recommendation at midday. Exactly the card the evening
change was written to stop printing, reintroduced by the fix for it.

So it is marked as not taking cars and filtered out of the candidate list,
the way a lot the permit does not admit is. It stays on the map and in the
data, because it exists and may reopen; it is just not an answer to "where
should I park". Rejected deleting the lot outright, which would be a claim
about the future I cannot support, and rejected leaving it scored, which is
the thing that was actively wrong.

The second thing is harder to act on. The same reading says the weekday curve
is now about 21 points low at midday for everything else, and in the direction
the closure predicts: Nutwood went from roughly 50 percent at that hour to
95.9, State College from roughly 43 to 90.5. Thirteen hundred spaces came off
the board and those drivers are now in the other three structures.

I have not refitted for that, deliberately. One reading at one hour is exactly
what produced the first evening curve, which a review round then showed was
overfitted: it had invented a 57 point cliff at an hour nobody measured and had
encoded a closure as demand. Doing the same thing again at midday would be the
same mistake with more consequences, because midday is when the screen is
actually used. The debt is recorded instead: `tests/parking_curve.test.mjs`
carries a NOT_FITTED list naming this reading and the reason, and a test that
fails if the curve ever starts matching it, so the exemption cannot outlive
what it is for. A second weekday midday reading settles it.

---

**2026-11-03: App Check, and why it is reCAPTCHA Enterprise**

The scoring endpoint has no sign in of its own and the Firestore rules let any
signed in account read the whole campus, so the thing neither of those stops is
a script with a free account hammering either one. App Check is the answer to
that: the database can tell which requests actually came from this app.

Chose reCAPTCHA Enterprise over the classic v3 provider. Classic works and was
what went in first, but the Firebase console marks it deprecated, and a project
nobody is going to maintain after this term should not be built on something
with an end date. Rejected doing nothing, which was tempting because the free
plan stops serving rather than billing, so the worst case is a dead app rather
than a bill; dead on the morning it is being marked is bad enough.

It is optional on purpose. `src/lib/firebase.ts` returns early when there is no
site key, so a clone with no key of its own still runs. That is the difference
between a grader being able to start the app and not.

Sequenced monitoring before enforcement deliberately. Turning enforcement on
first would have locked out the demo account and every clone at once, with no
way to see which requests were failing. Monitoring shows the traffic for a few
days and enforcement follows. The enforcement switch is still off, and that is
the one thing left on the README's list rather than an oversight.

Registered debug tokens are the sharp edge here: one is a permanent bypass for
anyone holding the UUID, and it gets printed to the browser console. Short
lived ones, deleted before enforcement goes live.

---

**2026-11-03: Three changes to the scorer that came out of the review round**

Each has its reasoning in the code; recording them here because a code comment
is not where a decision log is read from.

The walk plausibility filter now runs on spots and events, not just parking.
The old comment argued they did not need it because their coordinates come
from a building the browser looked up. True of our own screens, and not true
of the endpoint, which anything on the internet can post to. The first attempt
at this was wrong in an instructive way: it measured the candidate against the
parking destination for all three, and spots and events print a walk measured
from the class instead, so it let a bad spot through and dropped a good one.
It measures the leg the card prints now.

An event with no tags is scored at a stand in rather than having its tag weight
shared out. Redistributing meant a tagless event was judged only on walk and
soon, which are near maximal for almost every event, so it beat events that
actually matched the student. Parking already handled an unknown this way; the
two are consistent now. It is a trade rather than a straight win: it fixes the
top of the list and costs a little at the tail, where an event matching one of
its three topics now sits below one with no topics at all.

Reads and writes now say when the network is gone. A Firestore query resolves
from an empty cache offline instead of rejecting, so a dropped connection used
to render an empty week as a fact, and a write never settles at all, so Save
sat on "Saving..." forever. Both are bounded and both report now. The write
bound is 12 seconds, deliberately longer than Firestore's own 10 second offline
heuristic, so the app does not announce a failure while the SDK still thinks it
is online.

---

**2026-10-30: Those two checks turned back on**

The reasoning above was about writing the thing. It is written now, so the
cost it was avoiding has gone and what is left is the part it was wrong about:
they do catch things we care about.

Turned on, `noUnusedLocals` immediately found a dead `useCampusHour()` call in
Dashboard.tsx, left behind when both of that screen's loaders moved onto the
minute. Worse than the dead line was the nine line comment above it explaining
why there were two clocks, which there no longer were. That comment is exactly
the kind a reader trusts, and it would have had somebody explain the screen
wrongly. It also found a dead ref in ClubsView.tsx that had survived the move
from a reveal button to real pagination.

A parameter that genuinely has to stay unused gets an underscore, which both
checks ignore.

---

**2026-09-20: Replaced the .gitignore**

The repo had the Unity template, presumably whatever GitHub suggested when it
was created. It was ignoring Blender files and not ignoring `node_modules`,
`dist` or `.env`. A key committed once stays in the history forever even if
you delete the file after, so this got fixed before we connected anything. It
covers the Firebase service account key by name now as well, which is the one
thing in this project that really is a secret.

---

**2026-09-20: All data is seeded, and the UI has to say so**

There is no public feed for CSUF parking occupancy. We are writing a typical
fullness pattern by day and hour ourselves.

That is fine as long as we never imply it is live. Wording rule: always
"typically" or "usually" with the hour named, never "currently", "live" or a
bare count like "23 spaces left". Those are numbers we typed into a file.

---

**2026-09-20: CSUF does publish live parking counts, and we are still seeding**

Found the campus parking availability board. It shows current free spaces for
Nutwood, State College, Eastside North, Eastside South and S8/S10, with a
timestamp.

So "there is no data source" was wrong, and we fixed the README. But we are
still seeding, for two reasons. It is a web page and not an API, so we would be
parsing HTML that can change whenever they redesign it, and it would fail
silently in front of the class. And a browser cannot fetch another site
directly, so it would need a server side fetch we do not otherwise need.

What we did instead: took the real lot names and capacities off the board, and
we are recording actual readings at different times and days to shape the
seeded curve. So the numbers are based on real observations even though the app
is not reading them live.

One thing to be careful of: the first reading we took was a Sunday lunchtime.
Three of the structures were under 2% full and one was at 4%. S8 and S10 read
59%, which does not fit the others at all and we have not worked out why yet. Either way we need
weekday readings before the curve means anything.

Live integration is the obvious next version and we should say so when we
present.

---

**2026-09-20: How we are using AI**

Professor allows it. Our rule is that nobody merges code they cannot explain
line by line.

In practice: write the first version of anything new by hand, then let AI help
with the repeats. The scoring engine, the database design and the access rules
are ours. Once a week each of us explains someone else's file rather than our
own, because you cannot fake having read it.

---

**2026-10-01: Clubs come from TitanLink, not from us**

> Partly superseded later the same day. Keeping only the Active ones was
> the wrong call; the entry about the registration roster explains why, and
> the 320 clubs in the app now come from that roster.

Replaced the eight made up clubs with real ones pulled by hand from CSUF's
own student organization directory at fullerton.campuslabs.com/engage. Names,
summaries, descriptions and categories are theirs, stored verbatim. 701 orgs in
the directory, and we kept the ones that were Active. Nothing fetches it at
runtime, so there is nothing to break later.

The directory moves under you, which is worth knowing. At the first pull 392
orgs were Active. Re-checking the same afternoon it was 391, because Moving
Forward Community @ CSUF had been frozen in between. We dropped that one rather
than leave it in, since a club nobody can join is not worth recommending.

One trap worth writing down: the paging endpoint needs orderBy[0]=Name asc.
Without a stable sort the pages drift between requests and 17 orgs come back
twice while 17 never come back at all. Took a while to notice because the count
still looked about right.

---

**2026-10-09: We have a router after all, in the URL hash**

Reversing the 20 September decision. That one was right at the time: one user,
five screens, nothing to link to. Three things changed. There are six screens
now, the browser Back button was doing nothing on any of them, and we want to
be able to send each other a link to the screen we are looking at.

The objection back then was that real routes need a rewrite rule on the host so
a refresh on /parking does not 404. Hash routes do not, because everything after
the # never reaches the server. src/lib/useHashRoute.ts is about sixty lines
and no dependency. A hash that is not one of the six views leaves the screen
alone rather than bouncing to the dashboard, which is what kept catching us out
while we were testing.

---

**2026-10-09: CSUF's own colors, and one font**

The interface was stock Tailwind grays, which looked like every other project.
It uses the campus palette now, read off fullerton.edu: #00274c navy and #ff6800
orange. Two oranges, because #ff6800 only manages 2.9:1 on white, so it is for
fills and anything orange carrying a word uses the darker #a33f00.

The stock Tailwind palettes are switched off in the @theme block with
--color-slate-*: initial and friends. Worth knowing the trap: a leftover class
like bg-gray-100 then generates nothing at all and fails silently rather than
erroring, so it has to be caught by reading the built CSS.

IBM Plex Sans comes from Google Fonts in index.html. It falls back to the system
sans, so a slow campus network costs a font swap and not a broken page.

---

**2026-10-01: The club list comes from the registration roster, not the directory**

Shipped 66 clubs and that was wrong. Student Life and Leadership say there are
over 300, and Bhavy spotted immediately that most of his were missing.

The mistake was curating. The directory holds 701 records and 391 come back
Active, but Active only means the page is still live, not that the org is
registered this year. Nothing in the directory answers that, so we filtered to
Active and then hand picked 66 that covered a spread of interests. That is a
judgment nobody asked us to make and it quietly cut four fifths of the campus.

Student Life and Leadership publish the list that does answer it. It has 320
orgs on it, all FULLY RE-REGISTERED as of 22 September 2026.

So the roster decides membership and TitanLink supplies the detail. All 320
names resolve to a directory record. Three needed to be matched by hand because
the two systems write them differently: the roster's Pickleball Club is
TitanLink's Pickleball, its Society of Automotive Engineering is Society of
Automotive Engineering - Formula, and its CSUF Ski and Snowboard Club is Ski and
Snowboard Club. That last one matters more than it looks, because the event seed
joins clubs by name.

Moving Forward Community @ CSUF is the awkward one. It is on the roster but
TitanLink has frozen it since. Earlier we dropped it; now it is kept with its
real status in the status column, because the roster is the source of truth for
who is registered and silently dropping a row is how a list goes wrong without
anyone noticing.

---

**2026-10-01: Their categories and our tags are separate columns**

TitanLink's categories are broad ("Technology", "Service"). Our matching needs
narrower things like ai or cybersecurity. Rather than overwrite theirs, clubs
has both: categories holds their CategoryNames exactly as published, tags holds
our own vocabulary. That way the UI can cite them for one and own the other,
and nobody has to wonder which is which.

Keyword matching needed more care than expected. "Collegiate Program" matched
software-engineering, "we aim to provide" matched ai, and "educational
programming" matched software-engineering. Dropped "programming" as a keyword
entirely, since in student org writing it nearly always means events.

---

**2026-10-01: Parking occupancy is calibrated against real readings**

The occupancy curve used to be a single time of day shape with a per lot offset
derived from the length of the lot's name, which is to say no information at
all. Took readings off the campus parking board and set the per lot numbers
from those. Six readings were in data/parking_samples.csv at the time: one on a Sunday, two on a Tuesday evening,
two on a Thursday and one on a Friday. Three of them set the per lot numbers,
the Sunday, the first Thursday and the Friday, and the curve reproduces all
three exactly. The second Thursday timestamp was taken after the curve was
fitted and never used to fit it, which makes it the only real check we have,
and every lot came out within three points.

> Superseded on 5 November. Both 1 October readings are now excluded rather
> than fitted, because the closure moved the campus they describe, and a test
> requires them to stay more than three points off. Nothing is held out any
> more. There are nine readings on seven days now, and the curve reproduces
> the seven it is fitted to within 2.11 points, mean 0.57.

> This entry originally covered the Sunday and the Thursday only. The Friday
> reading came later, on 2026-10-30, and gave Friday its own shape. See the
> entry for that date.

The useful surprise was that the weekday and weekend shapes are not the same
curve scaled down. On a Thursday afternoon before the closure Eastside South
was at 88 percent because
it is nearest the academic buildings while State College sits at 43. On the
Sunday reading every structure was at or just under 4 percent, State College
highest at 4.01, except S8 and S10 at 59,
which is beside the stadium and the gym. Our first attempt applied the Thursday
numbers to the weekend too and had Eastside at 54 percent on a Sunday against
a real 0.5. The seed carried three columns from here, and a fourth from
2026-11-03, when weekday evenings got their own.

Worth saying plainly: six readings is not much. Four days, only the counted
facilities, and only a Sunday on the weekend side, so Saturday is an
assumption. The employee, resident and hourly lots are not on that board at all
and their numbers are guesses. The README says so and so does the parking
screen.

---

**2026-10-01: The scorer reads the day of the class, not today**

The occupancy lookup matched on hour alone, so asking on a Friday evening about
a Monday morning class read Friday's row. Worse, whichever day's row happened
to come first in the list won. It now matches on day as well, and the day is
worked out from today plus how many days ahead the class is, so nothing new has
to be passed in from the front end.

The same blindness was in two other places. arrive_by returned nothing for any
class whose time had already passed today, including one three days out, and
the countdown rendered a Monday class as "2100 min". Both fixed, and there are
tests for the Friday to Monday case now because it is the one a teammate is
most likely to click on a weekend.

---

**2026-10-01: Seed files run in a fixed order, and events check themselves**

Four seed files now instead of one, so the order matters: schema, seed,
seed_clubs, seed_spots, seed_events. seed_demo_account.sql runs after those,
once someone has signed up in the app. The order for the first five is written
at the bottom of seed.sql. (All of that is the Postgres design now; see
db/README.md for which files are live.)

Removing the made up clubs broke the events seed and we nearly missed it. The
events join clubs by name to pick a host, so when the names changed, eleven of
the twelve events were silently dropped and the insert reported success. There
is now a check at the end of seed_events.sql that raises if the count is not
twelve. A seed file that can lose rows without saying anything is worse than
one that fails.

---

**2026-10-23: Sign in is Supabase, not Firebase**

> Superseded the same day. The reasoning below is sound and the conclusion was
> still reversed, for reasons worth reading: see "Firebase after all" further
> down. Left here because a decisions file that quietly rewrites itself is
> worth nothing.

The plan said Firebase Authentication and the README said so too. Changed it
after reading our own schema.

The whole access model in db/schema.sql is twelve row level security policies.
Six of them turn on `auth.uid()`, which is Postgres asking which student the
request belongs to. The other six are open to any request carrying the
`authenticated` role. Both answers come out of the signed token Supabase
issues, one from the subject claim and one from the role claim.

A Firebase login produces a Firebase token, which Postgres has never heard of.
`auth.uid()` comes back null, the request is not `authenticated` either, and a
signed in student reads exactly nothing from any of the eight tables. Making it
work means taking Supabase's JWT secret,
minting our own tokens with it and keeping that secret somewhere the browser
cannot reach. That is a service we would have to write and host, for a login
button.

Supabase Auth hands back a token the database already trusts, and it does
Google sign in too, so we lose nothing by using it. It also drops a dependency
instead of adding one.

What this costs: Bhavy was going to wire Firebase up, so his task changes to
configuring the Supabase side, which is a dashboard job rather than a coding
one. The Firebase account is not needed at all.

---

**2026-10-23: Two sources, one set of function names**

campusData.ts used to be the sample campus and nothing else, with a comment
promising that swapping in queries later would only change that file. It
mostly held. Every read and write now asks who is signed in: a student with an
account gets their own rows out of the database, and the demo gets the arrays
in the file. (Written while that database was Postgres. It is Firestore now,
and the shape of this file did not change when it moved, which is the point.)

Eleven files read campus data through it. Three needed nothing at all. Four
changed for what accounts brought with them rather than for where rows come
from: the top bar and the profile screen need to know whose account it is, the
dashboard had to stop assuming everybody has a name, and the clubs screen had
to allow for columns the real schema lets be empty.

The other four are the honest exceptions, and they are all about timing rather
than shape. recommend.ts was restructured because it fetched in two rounds and
a sign in could land between them, which is a problem only a real query has.
Three more screens had to start reloading when the session changes, which a
local array never needed. So the promise held for the shape of the data and
not quite for when it arrives.

It is all or nothing, which matters. Building ids are what tie the tables
together, and the sample rows use readable ones like `b-cs` while Postgres
generates uuids. A screen holding half of each would join nothing to anything,
so there is no halfway state.

Keeping the sample rows rather than deleting them is deliberate. The deployed
demo has no account behind it and still has to work for a marker, and anyone
who clones the repository without making a project of their own gets a working
app instead of a blank screen and a stack trace.

One thing genuinely changed for callers: a write can fail now. Saving a profile
used to assign a variable and could not go wrong. It is a round trip to a
database today, so saving, adding a class and removing one all report what
happened on screen instead of failing in silence.

---

**2026-10-23: A new account is half empty, and we leave it that way**

Signing up gets us an email, a password and whatever name the form or Google
supplied. It does not get us a parking permit or a noise preference, and
`profiles` has both of those nullable for exactly that reason.

The easy thing would have been to default the permit to student and the noise
preference to the middle. We did not, because both would be the app making up
an answer and then ranking somebody's whole day against the made up answer. A
student permit would send an employee to a lot they get ticketed in.

So not knowing stays not knowing. With no permit on file the parking screen
comes back empty, which is the honest answer when every lot admits some permits
and not others, and the profile screen says that is why. With no noise
preference every study spot scores the same on noise and the other factors
decide the order. The profile screen opens with a short list of what is still
missing and what each thing is for.

This is the same rule we settled on for the walk anchor back on the eleventh:
returning nothing beats returning a confident number built on nothing.

---

**2026-10-23: The map draws circles, and it arrives late**

Leaflet's default marker is a PNG the library fetches by a relative path, which
a bundler moves, so the usual fix is importing the image files and rebuilding
the icon object by hand. We are drawing circles instead. They are SVG, there is
no file to go missing in a build, and the color can carry which marker is the
recommendation and which is your class.

Leaflet and its stylesheet are only wanted by the parking screen, so they are
fetched when somebody opens it. Compressed, the first load of JavaScript went
from 171 KB to 127 KB at the time, and the stylesheet with it from 12 KB to
6 KB. Those were measured against the Supabase build; the move to Firebase
pushed the first load up again, and the entry at the end of this file has the
figures that hold today. The split itself still earns its place: the map is
about 50 KB of the 224 KB the demo downloads. (Both numbers are
re-measurements. This said 51 of 217 and the Firebase entry below said 216,
which is how the drift was noticed: two figures for one thing, and the bundle
had grown past both since either was taken.)

The map is hidden from screen readers and is not a tab stop. Everything on it
is already in the list above it in words, and a reader tabbing into Leaflet
finds a box it cannot pan usefully and a handful of SVG circles with no names,
which is worse than finding nothing.

Getting the second half of that true took more than it looked. Switching the
keyboard option off drops the container out of the tab order, but Leaflet adds
its zoom buttons by default and those are real links. They stayed focusable
inside a region marked hidden, which is the worse version of the problem this
paragraph claims to avoid: a tab stop a screen reader refuses to describe. The
buttons are off now, and the map fits itself to the markers anyway. The OpenStreetMap attribution sits in the
caption underneath instead, where it is both visible and read out.

---

**2026-10-23: Proved the access rules with two accounts**

> About the Postgres design, which the project no longer uses. The work stands
> and the findings were real; they are just findings about db/schema.sql now
> rather than about what the app talks to.

The README has claimed since September that row level security means a student
can only ever read their own profile and their own schedule. Nothing had tested
it, because testing it needs a database and two accounts.

Ran it against a throwaway Postgres 17 instead of waiting. Supabase's `auth`
schema is not something you can install, so it was stubbed: a table of users,
and an `auth.uid()` that reads the current request's user out of a setting,
which is how Supabase's own does it. schema.sql and all four seed files then
loaded unchanged. One thing had to be added that is not in the repository:
Supabase grants `select` and the rest to its two roles for you, and a bare
Postgres does not, so without those grants every query fails on permissions
before a policy is ever consulted.

Twenty two checks, all of which hold. The ones worth writing down: The signup trigger creates a profile and
copies the name onto it. A fresh profile really does come out with no permit
and no noise preference. Alex sees one profile and one schedule, both his.
Jordan's profile is not merely unwritable, it is invisible: the update reports
success and changes nothing, which is what a policy does rather than an error.
Filing a class under Jordan's id is refused outright. A logged out visitor sees
zero buildings, zero clubs and zero profiles. The campus tables are readable
and not writable. The four check constraints we exercised all bite, out of the
seventeen in the file.

Worth being plain about the limit: this proves the policies, not the sign in.
`auth.uid()` was ours rather than Supabase's, so the path from a real token to
a real query is still untested and stays untested until the project exists.

---

**2026-10-23: Row level security goes on beside each table, and the file checks itself**

> Also about the Postgres design. The bug it describes was real and is worth
> knowing about; the Firestore equivalent is in the Firebase entries below.

A reviewer ran only the first half of schema.sql against a real Postgres and
then read the tables as the anonymous role: every student's name, major,
interests and whole week of whereabouts came back, and every one of them could
be rewritten. With the key that ships inside the JavaScript bundle.

The file had all eight `enable row level security` lines together in a block at
the end. Stop before that block and you have eight working tables with no
security on any of them. What makes it worse than an ordinary half-finished
job is that there is no symptom: every query succeeds, every screen fills in,
and the one guard the app has looks for an empty table, which is what a
*missing policy* looks like rather than a missing `enable`.

Two changes. Each table now switches it on in the line directly under its own
`create`, so the two cannot be separated by stopping early. And the file ends
with a block that counts the tables without row level security, counts the
policies, and looks for the signup trigger, raising if any of it is wrong.

Checked both ways against a throwaway Postgres 17. A full run prints "Schema
check passed: 8 tables protected, 12 policies, signup trigger present". A run
cut off at section 3 now leaves zero unprotected tables, and the check refuses
with "Expected 12 policies, found 0. Section 3 did not finish." The failure
went from silently wide open to visibly empty, which is the one the app
already knows how to complain about.

---

**2026-10-23: The app starts again when the person does**

Firebase keeps auth state in step across every open tab, as Supabase did
before it. A tab sitting on the dashboard can therefore be handed a different
account without anybody touching it, and the loaders keep showing the last
answer until the next one arrives.

In that window the screens blend two people. The account menu, which exists to
say which account you are in, showed one student's name above another's email.
The hero card paired one student's next class with the other's parking time,
and the arrive by figure underneath was arithmetic done on a class that was no
longer the one named above it. Worst of the three, the profile form still held
the previous person's details with Save enabled, and pressing it wrote them
into the new account's row, which that account's own policies naturally allow.

Fixed in one place rather than nine: the whole signed in app is keyed on who
is using it, so a change of person remounts it and every stale answer goes
with it. Starting again is the right behavior when the person changed, and it
cannot be forgotten by a screen added later.

---

**2026-10-23: Firebase after all**

Reversed the Supabase decision above, and the reversal is worth writing down
properly, because the argument against Firebase was not wrong so much as
narrower than it sounded.

The argument was that the access rules depend on a token Supabase issues, so a
Firebase login would leave a signed in student reading nothing. That is true,
and it is a fact about **Firebase plus Supabase**, not about Firebase. Read as
if it ruled Firebase out altogether, which is how it came across, it is wrong:
Firebase Auth with Firestore behind it is a perfectly coherent stack, it is
free for the two ways we sign people in, and it is what we agreed to in the
first place. Bhavy had been told auth was his.

There is a second reason, and it is the better one. Supabase puts a free
project to sleep after about a week of nobody touching it. For something we
demo every few weeks that means a dead database at exactly the wrong moment.
Firebase's free plan does not sleep; it has daily limits that reset.

Three things this costs, stated plainly because they are not small:

Eight tables of Postgres, twelve row level security policies and five seed
files stop being what the app talks to. They are still in db/ and still
accurate, because they are where the campus data was written down with its
sources. db/README.md says
which files are live.

Occupancy had to change shape. As rows it is twelve lots by seven days by
sixteen hours, 1,344 of them, and Firestore charges by the document read, so
every look at the parking screen would have been 1,344 reads for twelve lots'
worth of numbers. It is folded onto the lot document now, day then hour then
percentage. Checked the fold both ways: 1,344 rows in, 1,344 cells out, and a
spot read back the same figure it went in as.

(1,344 is the Postgres shape, and it is what db/seed.sql still produces. The live grid in src/lib/campusRows.ts is 1,232, because Eastside South is closed and carries no row at any hour of any day, which is 112 cells rather than the twenty an evening-only exclusion would have cost. The 2026-11-03 entry says why.)

Joins do not exist, so a building's name is copied onto every spot and a club's
name onto every event. That is ordinary for a document database and it means
the seed script is the only place those names can drift apart from the thing
they describe.

It also costs download. Firebase's SDK is a good deal bigger than Supabase's:
the first load went from 127 KB compressed to 158 KB, which is 31 KB more for
the login screen and the demo. Firestore is another 170 KB on top, and that one
is fetched only when somebody signs in, the same trick the map already uses.
Measured it rather than assuming: browsing the whole demo, parking screen and
map included, pulls 224 KB and never asks for the Firestore chunk at all. Only
an account pays for it. (158 and 216 when this entry was written. Re-measured
against the current build on 8 November 2026 with `gzip -c` over dist/: the
first load is 174 KB and the demo 224 KB, because the bundle has grown since.
The shape of the argument is unchanged and the Firestore chunk, 167 KB, is
still fetched only on sign in. The numbers are corrected in place rather than
left as a record, because both sentences claim what the app downloads now.)

Two things are genuinely better. Firestore denies anything the rules do not
allow, which is the opposite default from Postgres, where a table with security
switched off is wide open. The bug in the row level security entry above, where
a half-run schema left every student's whereabouts world readable, cannot
happen in this shape.

And Google sign in is a popup rather than a redirect, so it never touches the
address bar, and the whole business of keeping the sign in flow out of the
router's hash goes away.

One thing is worse and there is no way around it on the free plan. Postgres
created a student's profile row with a trigger the moment the account existed.
Firebase's equivalent is a Cloud Function, which needs a paid plan, so the app
writes that document itself the first time somebody signs in, and the rules
have to allow a person to create their own. It works, and it is one more thing
that can fail in a place a database used to handle on its own.

---

**2026-10-23: The sample campus moved into a file of its own**

src/lib/campusRows.ts is new and holds every sample row, with no imports except
types. Three things read it now: the demo, anyone running this without a
project, and the seed script that loads a real one.

That last one is why it had to move. The seed runs under Node, and the file it
used to live in reaches for Vite's import.meta.env by way of the session, which
Node cannot load. Copying the rows into the seed script would have meant two
copies of 320 clubs and 1,232 occupancy figures, drifting apart quietly. One
file, read by all three, cannot.

---

**2026-10-23: Nothing fetches on the clock any more**

Firestore charges by the document read, which turned a habit that cost nothing
on Postgres into a bill, and then into an outage.

Three things on the dashboard passed the minute tick into their loaders, so
each of them went and fetched the same documents once a minute whether or not
anything had changed. Counted: 176 reads a minute from one tab sitting there
with nobody touching it. The worst was the Coming up rail, which reads the
scored events, so every minute it was a whole round of recommendations and a
request to the scoring service, 115 documents, to notice that an event starting
at half past had started.

The free plan allows about 50,000 reads a day. One tab left open ate that in
about four and a half hours, and on the free plan Firestore does not bill you
when you run out, it simply stops answering until midnight. The app would have
died partway through a demo, for no reason anybody in the room could see.

What those three actually depend on is the hour, not the minute: which
occupancy row to show, and which events have not started yet. They key on the
hour now. The schedule table does need the minute, because it says whether you
are in a class, so it fetches once and works the statuses out again on the
tick instead of asking for the rows a second time.

Idle cost is now nothing per minute, and 151 reads an hour for the two that
still refresh. A twelve hour day with a tab open is about 1,800 of the 50,000.

The general shape of it is worth remembering: the clock changing is a reason to
recompute, not a reason to refetch.

---

**2026-10-23: A place can be shut on a day, not just at an hour**

The spots filter only ever looked at the clock. It read one opening time and
one closing time, and those held the Monday to Thursday hours, so every day of
the week looked like a Monday.

What that meant in practice: fifteen of the sixteen food places on this campus
publish no weekend hours at all. On a Saturday the app
offered all sixteen, each with a match score and a walk, while the opening
hours printed on the same card said they were shut. The one screen that is
supposed to answer "where can I go right now" was confidently wrong every
weekend.

Hours are stored by day now. A day that is not listed is a day the place is
shut, which is the point of the shape. The twenty four sets were derived from
the published notes already in the file rather than typed out again, and the
derivation was checked line by line against those notes before it was written
in.

One row has no day information at all: the library's group study rooms, whose
note gives a time and nothing else. The first attempt handed them all seven
days at that time, which had the app offering a room on a Sunday evening
inside a building that shut at five, with a match score. That is the same
mistake this entry is about, in the same screen, in the one row that was
filled in by hand rather than derived. A reviewer caught it. They take the
library's own week now, with their own eleven o'clock ceiling on top.

The scorer still takes one pair of times, because which day it is is a
question the caller has already answered. What it gained is a flag for shut
today, which has to be separate from having no hours on file: the first is a
reason to hide a place and the second is not.

Counted after: Monday to Thursday all twenty four are open, Friday twenty one,
Saturday nine of which one is food, Sunday seven and none of them food. That
last line is the library, which is the honest answer to where you can work on
a Sunday.

---

**2026-10-23: What the reviews found in the Firebase work**

Three independent reads of the migration, on the day it was written. Worth
recording what they caught, because two of them were things no amount of
clicking the app would have shown.

**The deploy command did not work.** The rules file, the README and db/README
all said `firebase deploy --only firestore:rules`. There was no firebase.json,
which is what points that command at a file, so it deployed nothing. The whole
security model was a file in a folder. Worse, the failure is silent in both
directions: the app behaves identically whether the live rules are this file,
an older paste, or the console's test mode, which is open to the world. The
Postgres version had a block at the end of the schema that refused to pass if
any of it had not run, and nothing replaced it. firebase.json is committed now.

**Signing up lost the name.** Firebase tells every listener about a new
account before `createUserWithEmailAndPassword` returns, and at that moment it
has no name for them: the name is a second call. Four screens ask for the
profile the instant a session appears, so the document was created in that gap
with nothing on it, and because the document then existed, it stayed nameless
forever. A student would type their name, sign up, and land on a dashboard
that did not know who they were. Reading it back and filling it in when it is
missing is what closes it. The comment claiming the old fix prevented this was
wrong and said so in the same file.

**Leaving the demo ended somebody else's session.** The demo deliberately
refuses to follow a sign in that happened in another tab. Sign out did not:
it called Firebase, which clears the session for the whole browser, so leaving
a demo in one tab dropped a signed in student out of another. Leaving the demo
is its own thing now, it touches no session, and the menu says "Leave demo"
rather than "Sign out", because pressing Sign out and landing inside an
account is a strange thing to do to somebody.

**The validators checked values, not shape.** Postgres had a fixed column list
and an update could not invent one. A document has whatever you put in it, so
six field checks said nothing about a seventh, and a browser could park a
megabyte of its own on a profile. `hasOnly` and `hasAll`, plus sizes.

**And a profile could not be deleted.** `allow delete: if false`, on the
reasoning that removing an account is an account thing. It is, and Firebase
cascades nothing, and a document's subcollections outlive it, so a withdrawn
student's whole week of whereabouts sat at a path nobody could reach. Postgres
did this without being asked. db/delete_account.mjs does it now.

So there is a test suite for them now, in tests/firestore_rules.test.mjs, which
asks what the rules do rather than whether they are there: a logged out visitor
sees nothing, an anonymous sign in counts as nobody, one student cannot reach
another's profile or schedule, the campus is read only from a browser, a
profile can only be created empty, and a class with a malformed time or an
extra field is refused. Thirty seven of them, and they pass.

They were worth not trusting on a first green run, so we broke the rules on
purpose, five times, and checked each break was caught: letting any signed in
student read any profile, dropping the anonymous guard, dropping the closed
field set, opening the campus to browser writes, and refusing the profile
delete again. Every one of them failed a test, and putting the rules back made
it green. A suite that cannot fail is worth nothing.

They need Firebase's emulator, which is a Java program, so running them means
having a JDK on the path. The README says how.

---

**2026-10-27: Events stopped having dates**

An event was a row with a starts_at on it, which is the obvious shape and the
wrong one for a set of made up rows. The timestamp was right on the day the
seed ran and wrong two weeks later, so the Events screen came up empty unless
somebody had remembered to re-run the seed, with the admin key on the laptop,
before the demo started.

Nothing caught it, and that is the part worth remembering. The demo that needs
no account builds its own dates at page load, so it always looked right. The
half that was broken was the half you only see after signing in, which is not
the half you check when you are in a hurry.

Three options. Re-seed before each demo, which is what we had been doing and
depends on remembering. Spread the events out far enough to cover every demo
date, which buys weeks and breaks again afterwards. Or stop storing the date.
We took the third: Firestore holds a day offset, a time of day and a length,
and src/lib/eventDates.ts turns those into a start and an end when the row is
read. The sample rows and the Firestore rows go through the same function, so
the two halves can no longer disagree about when an event is, which is the
thing that hid the bug in the first place.

It cost a type. StoredEvent is what the database holds and CampusEvent is that
plus the two timestamps, so a screen still reads e.starts_at and does not have
to know it was worked out a moment ago. No component changed.

There is a suite for it now, in tests/event_dates.test.mjs, which reads the
dates at five fixed points, two of them now in the past, and either side of
the November clock
change. We put both bugs back to check it could fail: a hard coded timezone
offset broke three of the nine, and treating the day offset as hours broke
four. It needs no emulator and no project, so it runs anywhere.

**2026-10-28: Reading the whole thing before the demo**

With the demo coming we read the whole codebase again rather than only the
parts we had just changed, in five passes: the event dates, the access rules
and the data layer, the Python engine, the React screens, and the
documentation against the code.

Five things came out of it that were worth the time. A single event document
left in the old shape took out four screens at once with a raw error rather
than one empty list, because one bad row threw for the whole collection. The
distance function returned a 500 for two points on opposite sides of the
planet, where a rounding error made the argument to a square root negative.
The arrive by time wrapped past midnight, so a walk longer than the time
before class answered a nine o'clock lecture with "leave at 16:05". The
profile rules capped how many interests you could have and said nothing about
what was inside them, so one interest could be a megabyte. And one of the
rules tests cleared the database halfway through its own run, which left every
test after it checking an empty database and passing for the wrong reason.

The last one is the one to remember. We had been treating that suite as proof
the rules worked, and for the back half of it we were proving nothing. The
suite now uses a second uid for the create test instead of wiping the data,
and the thirty seven tests all mean something.

Each of the five has a test on it now, and we put the bugs back afterwards to
check the tests failed. Two of them did not fail on the first attempt, which
is the whole reason for doing it: one assertion worked out its expected value
with the same arithmetic as the code it was checking, so changing the code
moved both sides and the test stayed green.

Worth recording about the review itself: one suggestion we were given would
have broken the test it was meant to fix. It assumed a write would be refused
whether the document existed or not, and that is not true here, because an
update is allowed to carry values that a create refuses. We only knew because
we went and read the rule. That is the argument for the explain-it-line-by-line
rule in a sentence.

---

## What each file does

Short notes so any of us can answer if we get asked about a file we did not
write. Read before a presentation.

**src/types.ts**: the shape of everything the dashboard renders. Eight table
types, one of which, the event, comes in a stored shape and a dated one, plus
the view name, the permit kinds, the kinds of spot, the three categories a
recommendation can belong to, the next class, a recommendation, the three lists
one request comes back with, a week of opening hours and the loading wrapper:
eighteen in all. Field names are the same as the database
columns, underscores and all, so nothing has to be renamed between the sample
rows and the real ones. Four of the profile fields are
nullable because the column is, which is what a new account looks like.

**src/lib/recommend.ts**: works out the next class, gathers everything the
scorer needs and posts it to the Python function. The fiddly part is the clock.
It reads campus local time through Intl rather than the laptop's own, because
the arrival hour decides which occupancy row gets looked up.

**db/seed_clubs.sql**: the 320 registered clubs, with a header recording where
they came from and when.

**db/seed_spots.sql**: Pollak Library floors and the campus dining locations,
read off CSUF's own pages. Noise ratings and seat counts are ours.

**src/App.tsx**: reads the screen from the URL hash, draws the sidebar and the
top bar around the content, and shows the right rail next to the dashboard and
the parking screen. It also holds the gate: you are in if you are signed in or
if you picked View demo, and otherwise it renders src/components/LoginView.tsx.
Sign out puts that back and resets the hash to the dashboard, and only the demo
gets reset with it, because a real account's edits are in Firestore and are
meant to still be there next time. It is a real session now rather than a
boolean, so a reload keeps a signed in student signed in. That is also why
there is a third state: for the moment before Firebase has answered, the screen
says so rather than flashing the login card at somebody who is already in.

The one line worth pointing at is the key on the wrapper. It is whoever is
using the app, so a change of person throws the whole tree away and starts
again. That is what stops two accounts being blended while the next set of
rows is still in flight.

**src/components/Sidebar.tsx**: six nav buttons in four groups. Three of the
groups carry a heading and the dashboard sits on its own above them, so
the list says what the app is for instead of reading as six loose words. Takes
the active view and a function to call when one is clicked, so it does not know
or care what the views actually do. Real buttons, not clickable divs, so
keyboard works. On a phone it becomes the bar across the bottom.

**src/components/TopBar.tsx**: the date on the left, the signed-in name on the
right. Clicking the name opens a two-item popover: Profile and settings, and
Sign out. It is written as a disclosure rather than with role="menu", because
that role promises arrow-key navigation and a roving tabindex, and two buttons
do not need either. Escape closes it, a click outside closes it, and focus goes
to the first item on open, and back to the name when you press Escape or pick
one of the two.

**src/components/LoginView.tsx**: the login card, and the only way in. View
demo enters with the sample profile and needs no account. The other three are
real: Google opens a popup, so the page is never left and the address bar is
never touched, and Create an account, Log in and Reset your password are one
form in three modes behind the chooser. The reset card hides the password box,
keeps the address already typed, and says the same thing whether or not that
address has an account, so it cannot be used to find out who is signed up.
Every failure is turned into a sentence somebody can act on rather than
Firebase's own code, including the one the browser raises when the request
never got anywhere; anything unrecognized gets a plain sentence and the code
goes to the console for whoever is debugging. With no project configured the three sign in paths say so and the
demo still works.

**src/components/ProfileView.tsx**: the only screen that writes. Name, major,
permit, noise preference, interests, goals and the weekly schedule are all
editable, and
saving bumps a version counter that every scored screen subscribes to, so they
reload. A signed in student's edits go to Firestore and are there next time. The
demo has nowhere to put them, so they last as long as the tab, which is what
the screen says. It also opens with a list of anything a new account has not
filled in yet, and, for a signed in account, the Delete account panel at the
bottom of it.

**src/components/DeleteAccount.tsx**: the way out for good, and a file of its
own because ProfileView is long enough already and shares nothing with it but
the page. Only rendered for a signed in account, since the demo has nothing to
delete. It asks for the proof before the dialog rather than after it, so nobody
agrees to something irreversible and is then told to go and type a password,
and it says which half happened if the delete stops part way through. The
button does not claim to be deleting while it is still waiting on Google's
window.

**src/lib/campusData.ts**: the one way in to any data at all, and the thing that
chooses between the sample campus and Firestore. The sample rows themselves live
in campusRows.ts. It started as src/data.ts with a
handful of values. Being async from the start is what paid off: the reads and
writes at the bottom now choose between Firestore and the rows above them
depending on who is signed in, and nothing that calls them changed.

**src/lib/firestoreData.ts**: the real reads and writes. A student's own
documents are reached by path rather than by filter: the profile is named after
their account id and the schedule is a subcollection under it, so the rules
check ownership by comparing, not by looking anything up. It is also where
Firestore's own answers get turned into sentences, and where a profile document
is created the first time somebody signs in, because Firebase has no free way
to do that when the account is made. eraseStudent is the other end of that: it
pages the schedule until the listing comes back empty, rather than listing once,
because a class added in between would outlive the profile it hangs under and
nothing could reach it afterwards. The same call takes a flag saying not to
create a profile, which campusData sets while an account is being erased.

**src/lib/campusRows.ts**: every sample row, and nothing else. No imports but
types, so that the seed script can read it under Node. The demo, an unconfigured
clone and a real project are all loaded from this one file.

**src/lib/firebase.ts**: the app, the auth and the database, or null. Null is
the ordinary state for anyone who has not made a project of their own, and
everything that touches it checks first, which is what keeps the demo working
with nothing behind it. All four config values have to be present: three and a
blank one builds something that fails on the first request instead of saying it
was never set up.

**src/lib/dataVersion.ts**: a counter meaning "load that again". Every screen
passes it to its loader. It is its own file because both the data layer and
the session need to ring it and neither can import the other.

**src/lib/session.ts**: signed in, signed out, or the demo. A module store
rather than a React context, so campusData.ts can ask who is signed in without
being a component. Sign up, log in and Google sign in live here too, and so
do the password reset and the three steps of leaving for good: accountProvider
says which proof to ask for, confirmItIsYou asks for it, and removeSignIn
removes the account once the rows are gone. They report failures back as
sentences rather than throwing Firebase's own codes at the screen, and
tests/auth_messages.test.mjs is what checks those sentences reach it.

**src/components/CampusMap.tsx**: the parking screen's map. Circle markers, no
image files, loaded only when that screen opens.

**src/components/NextClassCard.tsx**: course code, time, building, and how
long until it starts, plus the top lot when there is one. An evening or a
weekend still has a next class, it is just days out, which is why it says
"Monday" rather than a countdown. An empty schedule never reaches this card:
the dashboard shows an "Add your classes to get started" card with one button
instead.

**src/components/RecCard.tsx**: one card used for parking, spots and events.
What changes between them is the label at the top, the tint, the wording of the
footer link, and which rows are worth showing: an arrive by time is a parking
idea, and the walk reason is already printed above it. The percentage is text in a pill, not
a bar. The bars on screen are a different measurement entirely: how full a
structure usually is, on the parking list and in the right rail.

**src/components/Dashboard.tsx**: the greeting, the next class card, two
recommendation cards in a row, and today's classes as a table. Parking used to be
a third card there and moved into the next class card, because the same lot was
being printed twice on one screen. It also carries
the two empty states a new account meets: nothing ranked at all, and parking
with no permit on file, which gets a card of its own rather than a gap.

**src/components/ParkingView.tsx**: every lot the permit allows, ranked, with
an arrive by time and a directions link each. The map is loaded here and only
here, which is why the import is lazy. The empty state asks which of two
things is missing and says only the one that applies.

**src/components/SpotsView.tsx, ClubsView.tsx, EventsView.tsx**: the three
browse screens. Clubs is the only one that searches, and the search anchors to
the start of a word, because matching anywhere in 320 records made short
queries useless.

**src/components/StructureFill.tsx and UpcomingEvents.tsx**: the two halves of
the right rail, which only the dashboard and the parking screen show.
RightRail.tsx is the box they sit in.

**src/components/TodaySchedule.tsx**: today's classes as a table, with a
status on each. It fetches the rows once and works the statuses out again on
the clock, rather than fetching them again, which is the difference between
costing nothing while a tab sits open and costing a day's quota.

**src/components/Panel.tsx, Pill.tsx, PageHeader.tsx, SectionHeader.tsx,
icons.tsx**: the small shared pieces. Panel is the one worth knowing: every
screen hands it a loading state and it decides between "Loading", an error
box and the content, so no screen writes that out itself.

**src/main.tsx and src/index.css**: the entry point, and the theme. There is
no Tailwind config file: the palette is the @theme block in the stylesheet,
and it deliberately switches the stock palettes off so that a stray slate-800
generates nothing instead of quietly surviving a find and replace.

**tests/test_scoring.py**: the ranking engine's tests, which are the ones
with real logic to check. **tests/firestore_rules.test.mjs**: what the access
rules actually allow, run against Firebase's emulator.

**tests/event_dates.test.mjs**: the same event read at five points in the
future, including either side of the November clock change. Needs no emulator
and no project.

**src/lib/eventDates.ts**: the one place an event gets a date. Firestore
stores a day offset and a time of day rather than a timestamp, and this turns
them into a start and an end when the row is read. The demo rows and the real
ones both go through it, so the two cannot disagree.

**src/components/ConfirmDialog.tsx**: the only modal in the app. Everything
else answers after the fact with a status line, because almost nothing here is
worth interrupting somebody for. This is for the three that are: taking a class
off the schedule, which costs five fields to put back, and leaving, which ends
the session.

**src/components/ErrorBoundary.tsx**: catches a render that throws so the
whole page does not go white. Offers a reload rather than clearing the flag,
because re-rendering the same state would throw again and the button would
look broken.

**tests/test_api.py**: seventeen tests that go through the FastAPI app itself
rather than calling the scorer directly. It exists because the endpoint once
returned an empty body rather than a reason and every unit test stayed green.

**tests/clock_text.test.mjs**: clockText and clockRange and toMinutes. Midnight
and noon are the two cases worth pinning: replacing the modulo branch with a
bare one breaks both and nothing else notices.

**api/requirements.txt**: three packages the endpoint needs, pinned, and three more below a local-only marker for running it and the tests.

**src/vite-env.d.ts**: the types for import.meta.env, so the Firebase config
reads are checked rather than any.

**data/parking_samples.csv**: the nine readings off the campus availability board
board, which the occupancy curve was fitted to. **docs/architecture.mmd**: the
three recommenders drawn from the student's side, which GitHub renders.

**src/lib/useWideScreen.ts**: whether there is room for the right rail. It
asks the browser rather than leaving it to the rail's own classes, because
hiding something in CSS still mounts it, and the two panels in that rail were
fetching about 127 documents on every phone that could not show them.

**src/lib/time.ts, labels.ts, maps.ts**: the small shared ones: campus time
and the weekday names, the words for a kind of spot and for a person, and the
directions links. Each exists because two screens had drifted apart on the
same thing.

**src/lib/useAsync.ts, useHashRoute.ts, useMinuteTick.ts, useDataVersion.ts**:
loading state, the screen in the URL, a clock that ticks, and the signal that
says load it again. Every loader in the app takes the last two.

**db/seed_demo_account.sql**: the demo student. Separate from the other seeds
because a profile belongs to a person and a person only exists once somebody
has signed up.

**db/delete_account.mjs**: erases one student and their schedule with a
service account key, which is the path for erasing somebody else. A student
erasing their own does it from the profile screen now, through
campusData.deleteMyAccount, with no key and nothing but the rules. Firebase
cascades nothing either way, so this is the thing Postgres did for free.

**db/firestore.rules**: the access rules, and the whole security model. The
config ships in the browser bundle, so anyone can read it out and talk to the
database directly; these run on Google's side and are the only thing that
stops them. They also carry the validation that used to be check constraints.

**db/seed_firestore.mjs**: loads the campus. Reads campusRows.ts, folds the
occupancy onto each lot, and writes in batches because Firestore takes 500 at a
time and the club list alone is 320. Needs a service account key, which is the
one real secret here and bypasses every rule above.

**db/schema.sql**: the previous design, kept for reference. Eight tables, six
for the campus and two for a student, with twelve row level security policies
and a check at the end that refuses to pass if any of it did not run: without them anyone could read every row
from the browser console, because the key our app ships with is public.

**db/seed.sql and db/seed_events.sql**: the previous design, kept for
reference: buildings, lots and the occupancy curve, then the events. Events
were a file of their own because they were stored as dates and had to be put
back before each demo. They hold a day offset now, worked out on read, so
nothing expires and nothing has to be re-run.

**api/recommend.py**: the request and response shapes, and the three calls into
the ranking engine. The GET is still the health check we used to prove the
Python half deploys. Pydantic bounds the numbers it accepts, because an
occupancy of 150 used to sail through and score as if the lot were empty.

**api/scoring.py**: the ranking engine itself: one rank function, configured
three ways for parking, spots and events. Nothing in here touches the database
or the network, which is why it is the part with the most tests.

**src/lib/clubRanking.ts**: how the club list gets its order. The tag counts
across all 320 clubs, the rarity weighting, the badge order and the comparator
the screen sorts with. It was three closures inside ClubsView until the test
suite needed to reach it, and `node --test` can import a .ts from here but not
a .tsx component.

**tests/club_ranking.test.mjs**: seven cases over the above, including the real
case that forced the rarity weighting, so the choral society cannot climb back
above the software engineering clubs without a failure.

**tests/parking_curve.test.mjs**: seven cases over the occupancy curve, which had none at all while it was the only data the parking screen shows. Three of them read the board readings out of data/parking_samples.csv and check the curve against them, so adding a reading there tests the model without touching the test. The other four pin the shape of the seed: the 1 to 99 bounds, Eastside South carrying no rows at all, Friday keeping its own curve rather than the weekday evening one, and the weekend sliding only for the one lot that was measured sliding.

**src/lib/profileEdits.ts**: the decisions the profile screen makes before it
writes anything. The interest slug, the two tag ceilings and the class time
check were inside ProfileView.tsx, which is the largest file in the project and
the one with no tests, so the two rules that have to agree with
db/firestore.rules were the two nobody could check. The same move clubRanking.ts
made out of ClubsView.tsx, and for the same reason: node --test can import a .ts
from here but not a .tsx component.

**tests/profile_edits.test.mjs**: seven cases over the above. Two of them read
db/firestore.rules and check the ceilings the screen enforces against the ones
the database enforces, so the two drift apart in a test run rather than in front
of a student who types a thirteenth interest and gets a security rules error.
That agreement used to be a comment saying it was kept in step by hand.

**tests/auth_messages.test.mjs**: seven cases over the sentences the sign in
code produces. Two files have to agree for one to reach the screen: session.ts
turns a Firebase code into a sentence, and firestoreData.ts keeps the list of
sentences allowed through to a panel. They agreed by hand until the agreement
slipped, so these read both files and fail if a sentence is written, reachable
and swallowed. They also pin the two things the delete path cannot express in a
rule: that the schedule is paged until empty, and that nothing may write an
account that is being erased.

**tools/gen_test_cases.py**: writes TEST_CASES.md. Reads the test files for the
names, the fixtures and the assertions, runs all nine suites for the pass
column, and refuses to write anything if a suite will not run, so the document
cannot claim a pass nobody saw.

**tools/md_to_txt.py**: writes README.txt and TEST_CASES.txt, which are the
plain text copies the professor asked for. Headings get underlines, code gets
indented, a table too wide for the page becomes one labelled block per row, and
the output is checked for anything outside plain ASCII before it is written.

**TEST_CASES.md** and **TEST_CASES.txt**: every automated test by id, with what
it sets up, what it asserts and whether it passed. Generated, not maintained.

**README.txt**: the plain text copy of README.md. Generated, not maintained.

**package.json**: the front end's dependencies and the scripts. `dev`, `build`
and `typecheck`, plus `seed` and the six test commands.

**vite.config.ts**, **tsconfig.json**, **tsconfig.app.json**,
**tsconfig.node.json**: the build. The app config turns on
`allowImportingTsExtensions` with `noEmit`, which is what lets a test import
`../src/lib/time.ts` by its real name and still satisfy tsc, Vite and bare
Node at once.

**vercel.json**: the Python function settings and the response headers. No
routes and no rewrites: Vercel's own `api/` convention serves `/api/recommend`,
and the app's routes are hash routes, so nothing after the # ever reaches the
server and there is no deep link to fall back for.

**.env.example**: the five Firebase values, with no real ones in it. Copy to
`.env` and fill in. All five are public by design; the rules are what keeps the
data safe, not the keys.

**firebase.json**: points `firebase deploy --only firestore:rules` at
db/firestore.rules, and sets the port the emulator runs the rules tests on.

**DECISIONS.md**: this file.

**index.html**: the page Vite builds from, and the only one. It carries the
title, the Google Fonts link and the single `<div id="root">` the app mounts
into. A reload on `#/clubs` works without any rewrite, because everything
after the # stays in the browser and the request Vercel sees is for `/`.

**package-lock.json**: the exact dependency versions. Committed on purpose, so
Vercel and the three of us build from the same tree rather than whatever
resolves on the day.

**.gitignore**: what stays off the repository. `node_modules`, `dist`, `.venv`,
`.env` and the Firebase scratch files, plus `*.local.md`, which is how our own
working notes stay out of a graded submission.

**src/main.tsx**: sixteen lines. Mounts the app into the root div inside a
StrictMode and an ErrorBoundary, and nothing else. No router setup, because routing is a hash read in `useHashRoute`.

**src/index.css**: the whole theme, in Tailwind v4's `@theme` block. There is
no tailwind.config.js by design. The stock palettes are switched off with
`--color-slate-*: initial` and friends, so a class naming a colour we have not
declared emits no CSS at all rather than quietly rendering some default grey.
That is deliberate, and it is the one thing to know before editing a class name
here.

**src/components/RightRail.tsx**: the column beside the dashboard. It is the
same three recommendation lists the main screens show, trimmed to the top of
each, and it reads the same ranking rather than a second copy of it.

**src/components/UpcomingEvents.tsx**: the events card on the dashboard. It
formats its own dates with Intl rather than through `time.ts`, because an event
needs a weekday and a date and not just a clock time.

**src/components/StructureFill.tsx**: the little bar showing how full a parking
structure usually is at the hour you would arrive.

**README.md**: the front door. What the app does, how to run it, how to connect
a Firebase project, and what is done and still to do. `README.txt` is generated
from it.

**db/README.md**: the data layer on its own terms, including the move from
Postgres to Firestore and what survived it.

**db/seed.sql** and **db/seed_events.sql**: the Postgres seed, kept from before
the move. They are not what the app reads now, which is `campusRows.ts` and
Firestore, but they are the record of the original schema and the row counts
quoted in this file.
