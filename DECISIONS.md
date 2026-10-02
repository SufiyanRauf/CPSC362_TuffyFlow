# Decisions

Running notes on why things are the way they are. Mostly so we can answer
"why did you do it that way" without trying to remember six weeks later.

---

**2026-09-20 — TypeScript, not JavaScript**

The README said JavaScript and the presentation said TypeScript. Went with
TypeScript because that is what we presented, and because having the shape of
our database rows written down catches a lot of mistakes before the code runs.
Costs us some time up front.

---

**2026-09-20 — Vercel only, dropped GitHub Pages**

GitHub Pages only serves static files. Our scoring endpoint is a Python
function, so it cannot run there at all. Vercel serves the React app and runs
the Python function from the same repo.

---

**2026-09-20 — No router**

Five screens and one user. Using one piece of state for the active view and
showing the matching component does the same job. A router would also need
extra config on Vercel so that refreshing a page does not 404, and the catch
all rule it needs can swallow requests meant for our Python endpoint.

If we ever want links people can share, we can revisit this.

---

**2026-09-20 — One ranking engine, three configurations**

Parking, study spots and events looked like three features. They are the same
thing: throw out the candidates that are impossible, score the rest on a few
factors, sort, explain the top few. So we are writing one `rank()` function and
giving it different filters, factors and weights for each feature.

Less code, and the distance maths and sorting only get written once.

---

**2026-09-20 — Rule based scoring, not machine learning**

We have no real usage data, so a model would be learning from numbers we made
up. It also could not explain its own output, and every card in this app has to
say why it was picked. A weighted average of factors we chose is the right
answer here, not a worse one.

---

**2026-09-20 — Every factor scaled to 0 to 1 before weighting**

Walking minutes go up to about 25 and fullness goes up to 100. If we add the
raw numbers, fullness decides basically everything no matter what weights we
pick. Scaling first means a weight of 0.5 actually means half the decision.

We scale against fixed numbers we picked (best is a 2 minute walk, worst is 20)
rather than against the best and worst in that day's list. Scaling against the
list makes the top result read as 100% every single time.

---

**2026-09-20 — Permit type is a filter, not a scoring factor**

If it were a factor, a staff lot that happened to be empty and close could
outrank every lot we are actually allowed to park in, and the app would tell a
student to park somewhere they would get ticketed. Impossible options get
removed before anything is scored.

---

**2026-09-20 — The scoring service does not touch the database**

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

**2026-09-20 — Two TypeScript checks turned off**

`noUnusedLocals` and `noUnusedParameters` are off in tsconfig.app.json. They
fail the build on half finished code that runs fine locally, which costs time
and does not catch anything we care about. Everything else in strict mode stays
on.

---

**2026-09-20 — Replaced the .gitignore**

The repo had the Unity template, presumably whatever GitHub suggested when it
was created. It was ignoring Blender files and not ignoring `node_modules`,
`dist` or `.env`. A Supabase key committed once stays in the history forever
even if you delete the file after, so this got fixed before we connected
anything.

---

**2026-09-20 — All data is seeded, and the UI has to say so**

There is no public feed for CSUF parking occupancy. We are writing a typical
fullness pattern by day and hour ourselves.

That is fine as long as we never imply it is live. Wording rule: always
"typically" or "usually" with the hour named, never "currently", "live" or a
bare count like "23 spaces left". Those are numbers we typed into a file.

---

**2026-09-20 — CSUF does publish live parking counts, and we are still seeding**

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
59%, which does not fit the others at all and I have not worked out why yet. Either way we need
weekday readings before the curve means anything.

Live integration is the obvious next version and we should say so when we
present.

---

**2026-09-20 — How we are using AI**

Professor allows it. Our rule is that nobody merges code they cannot explain
line by line.

In practice: write the first version of anything new by hand, then let AI help
with the repeats. The scoring engine, the database design and the access rules
are ours. Once a week each of us explains someone else's file rather than our
own, because you cannot fake having read it.

---

**2026-10-01 — Clubs come from TitanLink, not from us**

Replaced the eight made up clubs with 66 real ones pulled by hand from CSUF's
own student organization directory at fullerton.campuslabs.com/engage. Names,
summaries, descriptions and categories are theirs, stored verbatim. 701 orgs in
the directory, and we kept 66 that cover a decent spread of interests. Nothing
fetches it at runtime, so there is nothing to break later.

The directory moves under you, which is worth knowing. At the first pull 392
orgs were Active. Re-checking the same afternoon it was 391, because Moving
Forward Community @ CSUF had been frozen in between. We dropped that one rather
than leave it in, since a club nobody can join is not worth recommending.

One trap worth writing down: the paging endpoint needs orderBy[0]=Name asc.
Without a stable sort the pages drift between requests and 17 orgs come back
twice while 17 never come back at all. Took a while to notice because the count
still looked about right.

---

**2026-10-01 — Their categories and our tags are separate columns**

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

**2026-10-01 — Parking occupancy is calibrated against real readings**

The occupancy curve used to be a single time of day shape with a per lot offset
derived from the length of the lot's name, which is to say no information at
all. Took readings off the campus parking board on a Sunday and on a Thursday
and set the per lot numbers from those. Three readings are in data/parking_samples.csv. Two of them set the per lot
numbers and the curve reproduces those to within a point. The third was taken
after the curve was fitted and never used to fit it, which makes it the only
real check we have.

The useful surprise was that the weekday and weekend shapes are not the same
curve scaled down. On a Thursday afternoon Eastside is at 88 per cent because
it is nearest the academic buildings while State College sits at 43. On the
Sunday reading every structure was at or under 4 per cent except S8 and S10 at 59,
which is beside the stadium and the gym. Our first attempt applied the Thursday
numbers to the weekend too and had Eastside at 54 per cent on a Sunday against
a real 0.5. The seed carries two columns now.

Worth saying plainly: two readings is not much. One timestamp per day, only the
five counted structures, and only a Sunday on the weekend side, so Saturday is
an assumption. The seven surface lots are not on that board at all and their
numbers are guesses. The README says so and so does the parking screen.

---

**2026-10-01 — The scorer reads the day of the class, not today**

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

**2026-10-01 — Seed files run in a fixed order, and events check themselves**

Four seed files now instead of one, so the order matters: schema, seed,
seed_clubs, seed_spots, seed_events. seed_demo_account.sql runs after those,
once someone has signed up in the app. It is written at the bottom of seed.sql.

Removing the made up clubs broke the events seed and we nearly missed it. The
events join clubs by name to pick a host, so when the names changed, eleven of
the twelve events were silently dropped and the insert reported success. There
is now a check at the end of seed_events.sql that raises if the count is not
twelve. A seed file that can lose rows without saying anything is worse than
one that fails.

---

## What each file does

Short notes so any of us can answer if we get asked about a file we did not
write. Read before a presentation.

**src/types.ts** — the shape of everything the dashboard renders. One type per
database table, plus the view name, the next class, a recommendation and the
loading wrapper. Fifteen in all:
the student, their next class, and a recommendation. Field names are the same
as the database columns, underscores and all, so nothing has to be renamed when
we swap in real data.

**src/lib/campusData.ts** — every row the app shows, shaped exactly like the
database rows and handed back from async functions. It started as src/data.ts
with a handful of sample values. Async matters: when Supabase goes in, these
functions become queries and nothing that calls them has to change.

**src/lib/recommend.ts** — works out the next class, gathers everything the
scorer needs and posts it to the Python function. The fiddly part is the clock.
It reads campus local time through Intl rather than the laptop's own, because
the arrival hour decides which occupancy row gets looked up.

**db/seed_clubs.sql** — the 66 TitanLink clubs, with a header recording where
they came from and when.

**db/seed_spots.sql** — Pollak Library floors and the campus dining locations,
read off CSUF's own pages. Noise ratings and seat counts are ours.

**src/App.tsx** — holds one piece of state for which screen is showing, draws the
sidebar next to the content, and shows the dashboard when the view is "home".
Parking, spots and clubs are real screens now; the map is still a placeholder.

**src/components/Sidebar.tsx** — the five nav buttons. Takes the active view and
a function to call when one is clicked, so it does not know or care what the
views actually do. Real buttons, not clickable divs, so keyboard works.

**src/components/NextClassCard.tsx** — course code, time, building, and minutes
until it starts. Returns a different card when there is no next class, which is
what evenings, weekends and empty schedules will hit.

**src/components/RecCard.tsx** — one card used for parking, spots and events. The
only thing that changes between them is the small label at the top. The match
percent is clamped to 0 to 100 before it sets the bar width, because a number
outside that range would either spill past the bar or render backwards as a
full one.

**src/components/Dashboard.tsx** — the greeting, the next class card, the three
recommendation cards in a row, and a placeholder where the map goes.

**db/schema.sql** — eight tables. Six describe the campus and are the same for
everyone. Two belong to a student. The bottom half is the access rules, which
are the part that actually matters: without them anyone could read every row
from the browser console, because the key our app ships with is public.

**db/seed.sql and db/seed_events.sql** — buildings, lots and the occupancy
curve, then the events. Events are separate because they are dated and have to
be re-run before each demo, otherwise they have all expired and the events card
is empty.

**api/recommend.py** — the request and response shapes, and the three calls into
the ranking engine. The GET is still the health check we used to prove the
Python half deploys. Pydantic bounds the numbers it accepts, because an
occupancy of 150 used to sail through and score as if the lot were empty.

**api/scoring.py** — the ranking engine itself: one rank function, configured
three ways for parking, spots and events. Nothing in here touches the database
or the network, which is why it is the one part with real tests.
