# TuffyFlow

TuffyFlow is a campus companion web application designed for students at California State University, Fullerton. The goal of the project is to help students make better decisions throughout their campus day by providing personalized recommendations for parking, campus study spaces, clubs, and events.

Current progress demo:
https://genre-fetch-60235643.figma.site/
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
Lot E

Estimated Walk: 2 minutes
Expected Availability: usually about 83% full at 10:00 AM

Suggested Arrival Time:
11:10 AM
```

---

### Campus Spot Recommendation

Students can find campus locations based on what they need at that moment.

Preferences include:

* Quiet study area
* Power outlets
* Indoor location
* Group study space
* Food nearby
* Distance from the next class

Example:

```text
Recommended Location:
Library North 3rd Floor

Quiet
Outlets Available
Indoor
5 minute walk from your next class

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

Match: 92%

Reason:
Software Engineering + Career Development
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
| Clubs and events | Time conflicts, already started | Tag overlap with interests, walking distance |

---

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

### Backend and Database

* Python with FastAPI, for the scoring endpoint
* PostgreSQL, hosted on Supabase
* Supabase Authentication

### Maps

* Leaflet
* OpenStreetMap

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
| Parking lot coordinates, same source, for 10 of the 12 lots | Typical parking occupancy curve, including every surface lot figure |
| Capacities of the five counted structures, from the parking availability board | Capacities of the seven surface lots |
| Two parking readings, Sun 20 Sep 12:23 and Thu 1 Oct 13:11, in `data/parking_samples.csv` | Which permit type each lot takes |
| 66 clubs: names, summaries, descriptions, categories and IDs, from the TitanLink directory, 1 Oct 2026 | Club interest tags, which are our own vocabulary and not a TitanLink field |
| Pollak Library floor designations, room booking rules and opening hours, from the library's own pages | |
| Dining locations and hours for all 16 food locations, from Campus Dining and Titan Shops | Noise ratings, seat counts and outlet availability for every spot |
| | All events |

Two lot coordinates, S8 and S10 and the Visitor Lot, are our estimates because
neither appears in CSUF's map data. The other 10 are CSUF's own figures.

Campus Dining publishes Monday to Thursday and Friday only, so no weekend hours
are stored for those thirteen. The three Titan Shops convenience stores come
from a different page, and one of them, Titan Shops and Titan Express, does open
on a Saturday.

### Parking occupancy

Availability is a typical pattern by day and hour, never a live reading. CSUF
publishes current counts for the five structures, and we used that board twice:
once on a Sunday and once on a Thursday. Those two readings set the per lot
numbers in `db/seed.sql`, and the curve reproduces both to within a point.

Two readings is not a lot, and it is worth being plain about what they do and
do not support. They cover only the five counted structures, one timestamp per
day, and only a Sunday on the weekend side, so Saturday is an assumption. The
seven surface lots are not on the board at all and their figures are guesses.

The weekday and weekend shapes turned out to be genuinely different rather than
one curve scaled down, which is why the seed carries two columns. On a weekday
Eastside fills to about 88 per cent because it is nearest the academic
buildings, while State College sits around 43. On the Sunday reading every
structure was under 4 per cent except S8 and S10 at 59, which is next to the
stadium and the gym.

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

The application has four parts:

* The browser runs the interface. It holds no permanent data.
* The database holds every row and decides who can read what.
* The scoring service is a Python function that ranks candidates.
* Vercel serves the site and runs the scoring function.

A single recommendation travels like this:

```text
Browser reads the session
  -> asks the database for this student's profile and class schedule
  -> works out the next class from the schedule and the current time
  -> asks for candidate lots, occupancy rows and upcoming events
  -> posts all of it to the scoring service in one request
  -> receives a ranked list with a reason for each
  -> draws the cards and the map pins
```

The scoring service gets the rows it needs in the request rather than querying the database, so it does not need any credentials of its own.

Access control uses PostgreSQL row level security, so the database enforces per row who may read what. A student can only ever read their own profile and their own class schedule, regardless of what the browser asks for.

---

## Current Project Status

The project is in the **early development stage**.

Completed:

* Project concept and problem identification
* Initial presentation
* UI prototype
* Database schema and seed data
* Recommendation algorithm design
* Technology stack selection
* React application setup
* Dashboard interface with sample data

In progress:

* Supabase setup
* Connecting the dashboard to real data

---

## Planned Development

1. Set up the React application
2. Build the dashboard interface
3. Set up Supabase and load the schema
4. Implement authentication and student profiles
5. Build the ranking engine
6. Develop parking recommendations
7. Develop club and event recommendations
8. Integrate maps
9. Develop campus space search
10. Test the application
11. Deploy

---

## Team

| Name | Role |
|---|---|
| Sufiyan Rauf | Development, database, recommendation engine |
| Phillip Bryan | Development, campus data |
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
