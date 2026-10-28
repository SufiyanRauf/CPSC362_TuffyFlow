# TuffyFlow

TuffyFlow is a campus companion web application designed for students at California State University, Fullerton. The goal of the project is to help students make better decisions throughout their campus day by providing personalized recommendations for parking, campus study spaces, clubs, and events.

Live app: https://tuffyflow.vercel.app

It serves everything described below, with one thing switched off: there is no
Firebase project behind it yet, so the login screen says so and View demo is
the way in. The demo is the whole app on the sample campus, which is what it
was built to be good for.

Adding the config is a build time thing rather than a setting, so whoever adds
it to Vercel has to redeploy afterwards or the live copy will not pick it up.

Early UI prototype, from before the app was built: https://genre-fetch-60235643.figma.site/

---

## Project Overview

Students often need to use multiple resources to answer simple questions such as:

* Where should I park for my next class?
* What time should I arrive on campus?
* Where can I study between classes?
* Which clubs or campus events match my interests?

TuffyFlow aims to bring these decisions into one application.

Instead of only displaying information, the application uses a student's schedule, interests, preferences, and campus locations to provide personalized recommendations.

---

## Core Features

### Parking Recommendation

TuffyFlow helps students identify a suitable parking location based on factors such as:

* Typical availability for that lot at the hour they would arrive
* Class location
* Class start time
* Walking distance
* Permit type

The recommendation also includes a **suggested arrival time**, so students know when to leave.

Example:

```text
Next Class: CPSC 362
Class Time: 11:30 AM

Recommended Parking:
Eastside North Parking Structure

Estimated Walk: 3 minutes
Expected fullness: usually about 99% full when you would arrive

Suggested Arrival Time:
11:07 AM
```

That lot is nearly full at that hour and still wins, because the walk counts
for more than the fullness does. The ranking is explaining a trade, not
claiming the lot is empty.

---

### Campus Spot Recommendation

Students can find campus locations based on what they need at that moment.

Preferences include:

* How quiet you want it
* Whether you need power outlets
* Distance from wherever today's classes put you, when they put you anywhere

The spots screen also filters by kind: study, food, charging or meeting space.

Example:

```text
Recommended Location:
Library North 3rd Floor

5 min from Computer Science
silent
has outlets

Match: 93%
```

---

### Club and Event Discovery

Students receive recommendations for clubs and campus events based on their interests, career goals, and availability.

Example interests:

* Software Engineering
* Cybersecurity
* Artificial Intelligence
* Career Development
* Entrepreneurship

Example:

```text
Recommended Event:
Resume Workshop with Industry Mentors

Time: 4:00 PM

Match: 90%

Reason:
matches career and software-engineering
```

---

`docs/architecture.mmd` draws this from the student's side: what we know about
them, the three recommenders it feeds, and what each one hands back. It is a
Mermaid file, which GitHub renders on its own.

---

## Recommendation System

TuffyFlow uses a rule based scoring system rather than machine learning. With no real usage history to learn from, a model would be learning from data we invented, and it could not explain its own output. Every recommendation in this app has to be able to say why it was chosen.

All three recommenders are the same algorithm with different inputs, so the project implements **one ranking engine** and configures it three ways:

```text
1. Remove candidates that are impossible
   (a permit you do not hold, an event that clashes with a class)

2. Score what remains on a few factors,
   each scaled to a value between 0 and 1

3. Multiply each factor by its weight and add them up

4. Sort, take the top few, and return a sentence
   explaining each one
```

The factors differ per feature:

| Feature | Filters | Factors |
|---|---|---|
| Parking | Permit type | Walking distance, typical fullness at arrival hour |
| Campus spots | Open now | Walking distance, noise level, power outlets |
| Events | Time conflicts with a class, already started | Tag overlap with interests, walking distance, how soon it starts |

---

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

### Backend and Database

* Python with FastAPI, for the scoring endpoint
* Cloud Firestore, for the campus and for each student's own data
* Firebase Authentication, for Google sign in and for email and password

Both are free on Firebase's Spark plan for the ways we sign people in.

### Maps

* Leaflet and OpenStreetMap, on the parking screen

### Deployment

* Vercel

### Development Tools

* Git and GitHub
* Visual Studio Code
* Jira for task tracking
* AI assisted development

---

## What is real and what is ours

Nothing is fetched at runtime, so every row ships inside the repository. That
is not the same as everything being made up. A good deal of it was read off
CSUF's own pages and is reproduced as published; the rest we estimated, and the
two are kept apart on purpose.

| Read from a named source | Ours, estimated or invented |
|---|---|
| Building names, codes and coordinates, from the campus map `locations.json`, 1 Oct 2026 | Class schedules and the demo student profile |
| Parking lot names, coordinates and permit types, from the parking map at `parking.fullerton.edu`, 9 Oct 2026 | Typical parking occupancy for the six lots CSUF does not count |
| Capacities of the four structures, from the parking availability board | |
| Three parking readings on two days, in `data/parking_samples.csv` | |
| 320 clubs: the Student Life and Leadership registered list of 22 Sep 2026, joined to the TitanLink directory for names, summaries, descriptions, categories and IDs, read 1 Oct 2026 | Club interest tags, which are our own vocabulary and not a TitanLink field |
| Pollak Library floor designations, room booking rules and opening hours, from the library's own pages | |
| Dining locations and hours for all 16 food locations, from Campus Dining and Titan Shops | Noise ratings, seat counts and outlet availability for every spot |
| | All events |

The lots were rebuilt on 9 October 2026 and the earlier version of this file was
wrong about them. CSUF renamed every lot in summer 2025, numbering them against
the campus entrances: E for employee, S for student, R for resident, and no
visitor lot at all, because visitors buy an hourly permit and use an hourly zone.
The campus map's `locations.json` still carries the old letters, so building the
lots from it produced names that no longer exist, two lots that were really the
same place listed twice, and the two Eastside structures the wrong way round.
Everything here now comes from the parking map at
`parking.fullerton.edu/_resources/pdfs/campus-parking-map.pdf`.

Capacity is only published for the facilities on the counts board, so every
other lot stores null rather than a number we invented. The board reports S8 and
S10 as one combined figure, which is not a capacity for either of them alone, so
neither one carries it.

Campus Dining publishes Monday to Thursday and Friday only, so no weekend hours
are stored for those thirteen. The three Titan Shops convenience stores come
from a different page, and one of them, The Express at Titan Shops, does open
on a Saturday.

### Parking occupancy

Availability is a typical pattern by day and hour, never a live reading. CSUF
publishes current counts for six facilities, the four structures plus S8 and S10
as one combined row, and we read that board three times: once on a Sunday and
twice on the Thursday. The Sunday reading and the first of the Thursday ones
set the per lot numbers, first written down in `db/seed.sql` and now carried
in `src/lib/campusRows.ts`, and the curve reproduces both to
within a point. The second Thursday reading came after the curve was already
fitted, which makes it the only real check we have.

Three readings, but only two independent days, and only two of them set the
numbers, so it is worth being plain about what they do and do not support. They
cover only the six counted facilities and only a Sunday on the weekend side, so
Saturday is an assumption. The six employee, resident and hourly lots are not on
the board at all and their figures are guesses.

The weekday and weekend shapes turned out to be genuinely different rather than
one curve scaled down, which is why the seed carries two columns. On a weekday
Eastside fills to about 88 percent because it is nearest the academic
buildings, while State College sits around 43. On the Sunday reading every
structure was at 4 percent or just under except S8 and S10 at 59, which are next to
the stadium and the gym.

We are not reading the board live in this version. It is a web page rather than
an API, so parsing it would break without warning if the page changed, and we
would rather the app not depend on that during a demo. Anywhere occupancy
appears in the interface it is described as typical or expected, never as
current.

The database is designed so a live source could replace these rows later
without redesigning anything, and that is the obvious next step for this
project.

---

## Architecture

The application has four parts.

* The browser runs the interface. The only thing it keeps is the session, so
  that a reload does not sign you out.
* The database holds every row and decides who can read what.
* The scoring service is a Python function that ranks candidates.
* Vercel serves the site and runs the scoring function.

There are two places the rows can come from, and who is signed in decides
which. A student with an account gets their own rows out of Firestore. The
demo, and anyone running this without a project of their own, gets the same
rows from `src/lib/campusRows.ts`, which is what the seed script loads. The
choice is made in `src/lib/campusData.ts`, so no screen has to work out where a
row came from. Two of them do ask who is signed in, but only to choose their wording:
the profile screen says whether changes are saved to an account, and the top
bar says which account you are in.

A single recommendation travels like this:

```text
Browser reads the session
  -> asks the database for this student's profile and class schedule
  -> works out the next class from the schedule and the current time
  -> asks for candidate lots, occupancy rows and upcoming events
  -> posts all of it to the scoring service in one request
  -> receives a ranked list with a reason for each
  -> draws the cards
```

The scoring service gets the rows it needs in the request rather than querying the database, so it does not need any credentials of its own.

Access control is Firestore security rules, in `db/firestore.rules`. They run
on Google's side, which is what makes them the security model rather than a
suggestion: the Firebase config ships inside the JavaScript bundle, so anyone
can read it out and talk to the database directly, and nothing in the React
code would stop them.

The campus is readable by any signed in student and writable by nobody. A
student's profile document is named after their account id, so "is this yours"
is a comparison rather than a lookup, and the rule grants reading one document
and never listing the collection, so asking for everybody's profiles is
refused. A class schedule is a subcollection underneath the profile, so owning
it is the path rather than a field somebody could set. Firestore denies
anything the rules do not explicitly allow, so a collection nobody mentions is
closed.

Being plain about the limits: signed in means anybody who made an account,
because nothing here checks the email is a CSUF one. That stops a passer-by
scraping the campus data, not somebody determined. The rules also name the
sign in provider, so that switching anonymous sign in on in the console cannot
quietly turn "signed in" into "anybody".

The rules also carry the validation that used to be check constraints: a permit
has to be one of the four, a noise preference has to be between one and five,
and a class has to end after it starts.

---

## Current Project Status

Every feature is built. What is left is account setup on two websites, which is
configuration rather than code.

Completed:

* Project concept, initial presentation and UI prototype
* Database schema, security policies and seed data
* The ranking engine, in Python, with 56 tests
* The access rules, with 23 tests against Firebase's emulator
* Dashboard, parking, spots, clubs, events and profile screens
* Sign up, log in, Google sign in and sign out, written and tested as far as
  they can be without a project to point them at
* A demo entry that needs no account, for showing the app without one
* The reads and writes a signed in student needs, and the security rules that
  decide what they are allowed to touch, written but not yet run against a
  live project
* A seed script that loads the campus, reading the same rows the demo shows
* Profile editing: name, major, permit, noise preference, interests, goals and
  the weekly schedule
* Campus data read from CSUF's own pages: buildings, lots, clubs, library and dining
* The campus map, on the parking screen
* Access rules written for every collection, with the validation that used to
  be database constraints
* Deployed to Vercel, which rebuilds on every push to main

Left to do, and all of it configuration rather than code:

1. Create the Firebase project, switch on the two ways of signing in, and
   create a Firestore database
2. Put the four config values into `.env` and into Vercel
3. Publish `db/firestore.rules`
4. Run `db/seed_firestore.mjs` once to load the campus
5. Redeploy on Vercel, because the config is read when the site is built and
   not when it is loaded

Until step 2 is done the app runs on the sample campus bundled in the
repository, the demo works, and the login screen says why signing in is
unavailable. That is deliberate: a marker who clones this repository gets a
working app rather than a blank screen.

---

## Setting it up

### Running it locally

```bash
npm install
npm run dev

# the scoring service, in a second terminal
python3 -m venv .venv && .venv/bin/pip install -r api/requirements.txt
.venv/bin/python -m uvicorn api.recommend:app --port 8000
```

There are two sets of tests. The ranking engine, which is the part with the
logic worth testing:

```bash
.venv/bin/python -m pytest tests/
```

And the access rules, which are the part worth being certain about. These run
against Firebase's emulator rather than a real project, so they need Java:

```bash
npm install -g firebase-tools     # once
brew install openjdk              # once, for the emulator
export PATH=/opt/homebrew/opt/openjdk/bin:$PATH
npm run test:rules
```

The cask version of the JDK wants an administrator password; the formula above
does not, and the emulator only needs it on the PATH.

They check what the rules actually do rather than whether they are present: a
logged out visitor sees nothing, an anonymous sign in counts as nobody, one
student cannot read or write another's profile or schedule, the campus is read
only from a browser, a profile can only be created empty, and a class with a
malformed time or a field nobody asked for is refused.

That is enough to use every screen on the sample campus. The rest connects it
to a database.

### Connecting Firebase

1. Make a project at console.firebase.google.com. Google Analytics is not
   needed and can be turned off.
2. Build, Authentication, Get started. Switch on **Email/Password** and
   **Google**. Both are free on the Spark plan.
3. Build, Firestore Database, Create database. Pick a location near you. Start
   in production mode: the rules you publish in step 6 replace whatever it
   starts with, and production mode denies everything until then, which is the
   safer thing to be wrong about.
4. Project settings, General. Under "Your apps", add a Web app. Firebase shows
   you a config object with four values worth having: `apiKey`, `authDomain`,
   `projectId` and `appId`.
5. Copy `.env.example` to `.env` and paste those four in. Restart
   `npm run dev`: Vite only reads `.env` at startup. Add the same four in
   Vercel, under Project Settings, Environment Variables, then redeploy.
   Without this the deployed app stays on the sample data while your machine
   does not, which is confusing to debug.
6. Publish the rules:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # pick the project you just made
   firebase deploy --only firestore:rules
   ```

   `firebase.json` at the repository root is what points that command at
   `db/firestore.rules`. You can also paste the file into the Rules tab in the
   console and press Publish, which does the same thing.

Signing in works at this point, but every screen is empty until the campus is
loaded.

### Loading the campus

The seed script writes with the Admin SDK, which bypasses the rules on purpose:
it runs on your machine, not in a browser.

1. Project settings, Service accounts, Generate new private key. That downloads
   a JSON file.
2. Keep it out of the repository. `.gitignore` already covers
   `serviceAccountKey*.json` and the name Firebase gives it, but the safest
   place is somewhere else entirely.
3. Run it:

   ```bash
   node db/seed_firestore.mjs ~/Downloads/your-key.json
   ```

Needs Node 22.18 or newer, which reads the TypeScript data file the script
imports without a build step. On an older Node it stops with
`ERR_UNKNOWN_FILE_EXTENSION` and nothing saying why.

It writes 17 buildings, 12 parking lots with their week of occupancy, 24
campus spots, 320 clubs and 12 events, and prints what it wrote. Running it
again overwrites rather than duplicating.

That key is the one real secret in this project. It ignores every rule in
`db/firestore.rules`. Do not commit it and do not paste it anywhere.

### Signing in for the first time

There is no demo account to set up. Firebase has no free way to run code when
somebody signs up, so the app writes a student's profile document itself the
first time they sign in, and the profile screen opens with a short list of what
is still missing: the permit, the noise preference and the class schedule.

Events hold a day offset and a time of day rather than a date, and the app
works the real dates out when it reads them, so a set seeded once still reads
as this week months later. It used to store timestamps, which meant re-running
the seed before every demo or a signed in account saw an empty Events screen,
while the demo that needs no account looked fine and gave no warning. Both
halves now go through the same function in `src/lib/eventDates.ts`, so they
cannot disagree about when an event is.

To erase somebody completely, including their schedule:

```bash
node db/delete_account.mjs ~/Downloads/your-key.json them@csu.fullerton.edu
```

Firebase does not cascade. Deleting an account on its own leaves the profile
document and every class in it behind, at a path nothing can reach.

---

## Team

| Name | Role |
|---|---|
| Sufiyan Rauf | Development, database, recommendation engine |
| Phillip Bryan | Campus data |
| Bhavy Patel | Development, System design, documentation |

---

## Course Information

Course: CPSC 362 – Foundations of Software Engineering
University: California State University, Fullerton
Professor: Mehdi Peiravi
Semester: Fall 2026

---

## Disclaimer

TuffyFlow is an academic project and is not an official California State University, Fullerton application.

Parking occupancy patterns, class schedules, and all events are sample data we
created. Building and lot details, club records, and library and dining
information were collected by hand from CSUF's own published pages, and the
table above says which is which. Club records come from the TitanLink student
organization directory.

---

**"What should I do or where should I go next?"**
