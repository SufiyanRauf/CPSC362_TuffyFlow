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

**2026-09-20 — How we are using AI**

Professor allows it. Our rule is that nobody merges code they cannot explain
line by line.

In practice: write the first version of anything new by hand, then let AI help
with the repeats. The scoring engine, the database design and the access rules
are ours. Once a week each of us explains someone else's file rather than our
own, because you cannot fake having read it.
