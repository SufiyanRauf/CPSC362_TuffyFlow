# TuffyFlow

TuffyFlow is a campus companion web application designed for students at California State University, Fullerton. The goal of the project is to help students make better decisions throughout their campus day by providing personalized recommendations for parking, campus study spaces, clubs, and events.

The project is being developed for **CPSC 362 – Foundations of Software Engineering** at California State University, Fullerton.

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
Eastside Parking Structure

Estimated Walk: 4 minutes
Expected Availability: usually about 20% open at 10:00 AM

Suggested Arrival Time:
11:16 AM
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
ECS Study Area

Quiet
Outlets Available
Indoor
Same Building As Next Class

Match: 94%
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
| Campus spots | Building | Walking distance, noise level, power outlets |
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

## What is real and what is seeded

All data in this application is seeded by the development team. There is no live data source.

| Real | Seeded by us |
|---|---|
| Campus building and lot locations | Class schedules |
| Building names and codes | Parking occupancy patterns |
| | Clubs and events |
| | Study spot details |

Parking availability is a typical occupancy pattern by day and hour that we wrote, not a live measurement. There is no public feed for CSUF parking occupancy. Anywhere this appears in the interface it is described as typical or expected, never as current or live.

The database is designed so that a real data source could replace the seeded rows later without redesigning anything.

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
| Bhavy Patel | Development, presentations and documentation |

---

## Course Information

Course: CPSC 362 – Foundations of Software Engineering
University: California State University, Fullerton
Professor: Mehdi Peiravi
Semester: Fall 2026

---

## Disclaimer

TuffyFlow is an academic project and is not an official California State University, Fullerton application.

Parking availability, campus locations, clubs, events, and other information used in this project are sample or manually collected data.

---

**"What should I do or where should I go next?"**
