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

Instead of only displaying information, the application will use a student's schedule, interests, preferences, campus locations, and available data to provide personalized recommendations.

---

## Core Features

### Parking Recommendation

TuffyFlow will help students identify a suitable parking location based on factors such as:

* Current parking availability
* Class location
* Class start time
* Walking distance
* Historical parking trends

A future goal is to provide a **recommended arrival time** so students know when they should arrive on campus.

Example:

```text
Next Class: CPSC 362
Class Time: 11:30 AM

Recommended Parking:
Eastside Parking Structure

Estimated Walk: 8 minutes
Parking Availability: Good

Recommended Arrival Time:
10:50 AM
```

---

### Campus Spot Recommendation

Students will be able to search for campus locations based on what they need at that moment.

Possible preferences include:

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
4 Minutes From Next Class

Match: 94%
```

---

### Club and Event Discovery

Students will receive recommendations for clubs and campus events based on their interests, major, career goals, and availability.

Example interests:

* Software Engineering
* Cybersecurity
* Artificial Intelligence
* Career Development
* Entrepreneurship

Example:

```text
Recommended Event:
ACM Tech Workshop

Time: 4:00 PM

Match: 92%

Reason:
Software Engineering + Career Development
```

---

## Recommendation System

TuffyFlow will initially use a rule-based recommendation system.

For example:

### Parking

```text
Parking Score =
Availability
+ Walking Distance
+ Class Start Time
+ Historical Parking Data
```

### Campus Spaces

```text
Space Score =
Crowd Level
+ Distance
+ Student Preferences
+ Time Until Next Class
```

### Clubs and Events

```text
Club Match =
Student Interests
+ Major
+ Career Goals
+ Schedule Availability
```

Machine learning is not required for the initial version of the application. More advanced prediction models may be explored later if enough historical data becomes available.

---

## Proposed Tech Stack

### Frontend

* React
* Vite
* JavaScript
* Tailwind CSS

### Backend / Database

* Supabase
* PostgreSQL
* Supabase Authentication

### Maps

* Leaflet
* OpenStreetMap

### Deployment

* Vercel

### Development Tools

* Git
* GitHub
* Visual Studio Code

---

## Current Project Status

The project is currently in the **planning and prototyping stage**.

Completed so far:

* Initial project concept
* Problem identification
* Initial presentation
* UI prototype
* Parking recommendation concept
* Campus space recommendation concept
* Club and event recommendation concept
* Initial technology stack selection
* Research into public CSUF parking availability data

---

## Prototype

The current prototype includes:

* Student dashboard
* Parking recommendation interface
* Campus spot recommendation interface
* Club and event recommendation interface
* Student profile and preferences
* Sample recommendation scores

The prototype currently uses sample data and is intended to demonstrate the proposed user experience.

---

## Planned Development

Our next steps include:

1. Finalize project requirements
2. Create user stories and use cases
3. Design the database
4. Set up the React application
5. Set up Supabase
6. Implement authentication
7. Develop parking recommendations
8. Develop campus-space recommendations
9. Develop club and event recommendations
10. Integrate maps
11. Test the application
12. Deploy the MVP

---

## Shipping Next

The next version of TuffyFlow will focus on turning the current prototype into a working MVP.

The first development milestone will include:

* Basic React frontend
* Navigation between major features
* Supabase database connection
* Student profile
* Sample parking data
* Initial recommendation logic

Future versions may include real-time parking information, historical parking analysis, recommended arrival times, crowdsourced campus-space availability, notifications, and improved personalization.

---

## Team

**Team Name:** TBD

**Team Members:**

* Team Member 1
* Team Member 2
* Team Member 3
* Team Member 4

Responsibilities will be divided across frontend development, backend/database development, recommendation logic, testing, documentation, and project management.

---

## Course Information

**Course:** CPSC 362 – Foundations of Software Engineering
**University:** California State University, Fullerton
**Professor:** Mehdi Peiravi
**Semester:** Fall 2026

---

## Disclaimer

TuffyFlow is currently an academic project and is not an official California State University, Fullerton application.

Parking availability, campus locations, clubs, events, and other information used during development may initially contain sample or manually collected data.

Official CSUF integrations will only be used where appropriate and where data access is publicly available or authorized.

---

**“What should I do or where should I go next?”**
