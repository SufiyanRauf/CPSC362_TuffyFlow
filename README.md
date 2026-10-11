# TuffyFlow

TuffyFlow is a campus companion web application designed for students at California State University, Fullerton. The goal of the project is to help students make better decisions throughout their campus day by providing personalized recommendations for parking, campus study spaces, clubs, and events.

Live app: https://tuffyflow.vercel.app

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

Estimated Walk: 2 minutes
Expected fullness: usually about 92% full when you would arrive

Suggested Arrival Time:
11:09 AM
```

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

Match: 100%

Reason:
matches career and software-engineering
```

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
* PostgreSQL, hosted on Supabase (schema written, project not created yet)
* Firebase Authentication for Google sign in (planned, the login screen is built but not wired up)

### Maps

* Leaflet and OpenStreetMap (planned, not built yet)

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
twice on the Thursday. Those two readings set the per lot numbers in
`db/seed.sql`, and the curve reproduces both to within a point.

Three readings, but only two independent days, and only two of them set the
numbers, so it is worth being plain about what they do and do not support. They
cover only the six counted facilities and only a Sunday on the weekend side, so
Saturday is an assumption. The six employee, resident and hourly lots are not on
the board at all and their figures are guesses.

The weekday and weekend shapes turned out to be genuinely different rather than
one curve scaled down, which is why the seed carries two columns. On a weekday
Eastside fills to about 88 per cent because it is nearest the academic
buildings, while State College sits around 43. On the Sunday reading every
structure was at or under 4 per cent except S8 and S10 at 59, which are next to
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

The application has four parts. Three of them exist today; the database is
written but not yet created, so the browser reads the same rows from a
TypeScript file shaped like the tables.

* The browser runs the interface. It holds no permanent data.
* The database holds every row and decides who can read what.
* The scoring service is a Python function that ranks candidates.
* Vercel serves the site and runs the scoring function.

A single recommendation travels like this, with the database step standing in
for `src/lib/campusData.ts` until Supabase exists:

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

Access control is designed around PostgreSQL row level security, so the database
enforces per row who may read what. A student would only ever read their own
profile and their own class schedule, regardless of what the browser asks for.
The twelve policies are written in `db/schema.sql` and apply cleanly to a real
Postgres, but nothing is enforcing them yet because there is no database and no
sign in.

---

## Current Project Status

All six screens work against real data held in the repository, behind a login screen.

Completed:

* Project concept, initial presentation and UI prototype
* Database schema, security policies and seed data
* The ranking engine, in Python, with tests
* Dashboard, parking, spots, clubs, events and profile screens
* Login screen, with a demo entry that needs no account
* Profile editing: permit, noise preference, interests, goals and the weekly schedule
* Campus data read from CSUF's own pages: buildings, lots, clubs, library and dining
* Deployed to Vercel

In progress:

* Supabase setup, which is the one thing blocking real queries and sign in

Not started:

* Authentication and the map

---

## Planned Development

1. Set up Supabase and load the schema
2. Swap the data accessors over to real queries
3. Wire the login screen up to Firebase
4. Integrate the map
5. Test with two accounts to prove the security policies hold
6. Final deployment

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
