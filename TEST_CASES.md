# Test cases

Tuffy Flow, CPSC 362. Every case below is a real automated test in this
repository, listed by the id we use to refer to it. Nothing here is aspirational:
the whole table is generated from the test files, so the count and the names
cannot drift from what actually runs.

**136 cases, all passing.** Run them all with the three commands below.

| Suite | Cases | Command |
|---|---|---|
| Ranking engine | 73 | `.venv/bin/python -m pytest tests/test_scoring.py` |
| Scoring endpoint | 15 | `.venv/bin/python -m pytest tests/test_api.py` |
| Security rules | 32 | `npm run test:rules` |
| Event dating | 9 | `npm run test:dates` |
| Clock formatting | 7 | `npm run test:dates` |

---

## Ranking engine (73 cases)

Pure functions over dicts. No web framework, no database, so these run in under a second.

File: `tests/test_scoring.py`

| ID | What it checks |
|---|---|
| SC-01 | Haversine matches real campus distance |
| SC-02 | Haversine catches missing radians conversion |
| SC-03 | Walk minutes is a sensible campus walk |
| SC-04 | Normalize lower is better |
| SC-05 | Normalize clamps outside the anchors |
| SC-06 | Normalize handles equal anchors |
| SC-07 | Normalize scores not a number as zero rather than a full mark |
| SC-08 | Permit is a filter not a penalty |
| SC-09 | A lot that takes several permits shows up for each of them |
| SC-10 | A lot with a wrong coordinate is not offered at all |
| SC-11 | A lot further out than anywhere on campus is still offered |
| SC-12 | Closer lot outranks further lot when equally full |
| SC-13 | A full lot loses to an emptier one at the same distance |
| SC-14 | Missing availability does not score as empty |
| SC-15 | Missing availability says so in the reason |
| SC-16 | Scores are not all near 100 on a bad day |
| SC-17 | Match percent is a whole number 0 to 100 |
| SC-18 | Arrive by subtracts walk and buffer |
| SC-19 | Arrive by gives up rather than wrapping past midnight |
| SC-20 | Haversine survives two points on opposite sides of the planet |
| SC-21 | Weight tables each add up to one |
| SC-22 | Rank is stable when everything ties |
| SC-23 | Rank handles nothing to rank and honours top n |
| SC-24 | Arrive by is none when it has already passed |
| SC-25 | Arrive by is none when the minute to leave is this minute |
| SC-26 | Event tag overlap uses sets not counts |
| SC-27 | An event is scored over its own tags not the smaller set |
| SC-28 | Event clashing with a class is filtered out |
| SC-29 | A class on a later day still blocks an event |
| SC-30 | An event running past midnight still clashes with a class |
| SC-31 | Sooner always scores strictly better |
| SC-32 | A quieter spot is never worse than a louder one |
| SC-33 | Spot in the building you are already in says so |
| SC-34 | Closed spot is filtered out |
| SC-35 | Fullness reads the class day not today |
| SC-36 | Class day wraps past saturday |
| SC-37 | Arrive by stands for a class on another day |
| SC-38 | Spot walk is measured from todays class not the next one |
| SC-39 | Event walk is measured from its own day |
| SC-40 | A day with no classes has no anchor |
| SC-41 | A class hours away does not anchor the evening |
| SC-42 | Tie break prefers the class still to come |
| SC-43 | The anchor does not depend on the order the schedule arrives in |
| SC-44 | A spot with no class that day is neither a perfect walk nor a hopeless one |
| SC-45 | Anchor picks the class nearest in time |
| SC-46 | Parking still measures from the next class |
| SC-47 | The walk reason does not repeat the number |
| SC-48 | No permit means no lot is recommended |
| SC-49 | An unset noise preference does not order the spots |
| SC-50 | An unset noise preference still says how loud the spot is |
| SC-51 | Events still rank for a profile with no interests |
| SC-52 | The request model takes a profile with nothing filled in |
| SC-53 | An unset noise preference does not cost a spot anything |
| SC-54 | An unset noise preference does not hand the ranking to outlets |
| SC-55 | The noise bounds still bite when a preference is given |
| SC-56 | The model takes an explicit null and not just a missing key |
| SC-57 | A permit that is not one of the four is refused |
| SC-58 | The parking result carries the fullness as a number |
| SC-59 | Only parking carries a fullness |
| SC-60 | A profile with nothing on it does not cost an event anything |
| SC-61 | Tags we cannot judge do not score like tags that are wrong |
| SC-62 | A brand new account does not see every event at the same low score |
| SC-63 | A time that is not a time is refused |
| SC-64 | Empty hours and missing hours mean the same thing |
| SC-65 | A coordinate that is not on earth is refused |
| SC-66 | A factor that returns not a number scores zero not a perfect match |
| SC-67 | A body with infinity in it gets a reason not a crash |
| SC-68 | Somewhere shut today is not recommended whatever the clock says |
| SC-69 | Hours we never knew are not a reason to rule somewhere out |
| SC-70 | Open today still gets checked against the clock |
| SC-71 | Somewhere that shuts after midnight is open either side of it |
| SC-72 | The request model defaults closed today to false |
| SC-73 | The published hours line up with what the app can offer |

---

## Scoring endpoint (15 cases)

Drives the FastAPI app itself over HTTP. It exists because the endpoint once returned an empty body and every unit test stayed green.

File: `tests/test_api.py`

| ID | What it checks |
|---|---|
| API-01 | The health check answers on the same path as the post |
| API-02 | A well formed request comes back with the three categories |
| API-03 | The parking result arrives over http with its fullness and arrive by |
| API-04 | A body carrying infinity is a 422 through the app not a 500 |
| API-05 | The reply to an infinity body does not repeat the value |
| API-06 | Not a number and a nested coordinate go through the same handler |
| API-07 | A body that is not json at all is a 422 |
| API-08 | A body that is not an object is a 422 |
| API-09 | A number outside its bounds is a 422 with the field named |
| API-10 | Every bounded number in the body is a 422 with the field named |
| API-11 | An event that has already been is filtered rather than refused |
| API-12 | A class later in the week is a request the endpoint accepts |
| API-13 | The row caps sit well above a real campus |
| API-14 | An empty campus is an empty answer rather than an error |
| API-15 | A brand new account posts successfully with nothing on its profile |

---

## Security rules (32 cases)

Runs against the real Firestore emulator. Every case asserts what is refused, not what is allowed. Needs firebase-tools and a JDK.

File: `tests/firestore_rules.test.mjs`

| ID | What it checks |
|---|---|
| SEC-01 | Cannot read the campus |
| SEC-02 | Cannot read anybody’s profile |
| SEC-03 | Counts as nobody, so the campus stays shut |
| SEC-04 | Can read the campus |
| SEC-05 | Cannot change the campus |
| SEC-06 | Cannot read the other’s profile |
| SEC-07 | Cannot list everybody’s profiles |
| SEC-08 | Cannot write the other’s profile |
| SEC-09 | Cannot create a profile at somebody else’s uid |
| SEC-10 | Cannot read or touch the other’s schedule |
| SEC-11 | Can be created, but only empty |
| SEC-12 | Cannot be created with any one of the five fields already filled in |
| SEC-13 | Cannot carry a field nobody asked for |
| SEC-14 | Can be updated with sensible values |
| SEC-15 | Refuses a permit that is not one of the four |
| SEC-16 | Refuses a bad tag at any of the twelve positions |
| SEC-17 | Refuses tags that are not a list at all |
| SEC-18 | Refuses more tags than the profile screen can make |
| SEC-19 | Refuses a name or a major longer than the rule allows |
| SEC-20 | Refuses an update that removes any of the six fields |
| SEC-21 | Refuses a noise level outside one to five |
| SEC-22 | Can be deleted, because somebody has to be able to leave |
| SEC-23 | Takes a sensible class |
| SEC-24 | Can be read back and cleared |
| SEC-25 | Lets the owner fetch one meeting on its own |
| SEC-26 | Refuses a time without seconds, so the end > start test stays honest |
| SEC-27 | Refuses a time that is not a time |
| SEC-28 | Refuses a class that ends before it starts |
| SEC-29 | Refuses a day outside the week |
| SEC-30 | Refuses a class with no course code or no building |
| SEC-31 | Refuses a course code or a building id one character over the cap |
| SEC-32 | Refuses a field nobody asked for |

---

## Event dating (9 cases)

Events store a day offset rather than a timestamp, so the real dates are worked out on read. These cover the clock change and the year boundary.

File: `tests/event_dates.test.mjs`

| ID | What it checks |
|---|---|
| DATE-01 | Every event is still upcoming, whenever it is read |
| DATE-02 | An event lands at the campus time its row asks for |
| DATE-03 | The day comes from the campus date, not the machine or UTC |
| DATE-04 | The day offset carries across a year boundary |
| DATE-05 | An event runs for as long as it says |
| DATE-06 | The clocks moving does not drag an event to the wrong time |
| DATE-07 | Events come back in order whatever order they arrive in |
| DATE-08 | A row that cannot be dated is dropped, not fatal |
| DATE-09 | A stored row needs no date of its own |

---

## Clock formatting (7 cases)

Every time a student reads goes through one helper. Midnight and noon are the cases worth pinning.

File: `tests/clock_text.test.mjs`

| ID | What it checks |
|---|---|
| CLK-01 | ClockText |
| CLK-02 | ClockText drops the seconds the database stores |
| CLK-03 | ClockText hands back anything that is not a time |
| CLK-04 | ClockRange says the meridiem once when both ends share it |
| CLK-05 | ClockRange keeps both when the range crosses noon or midnight |
| CLK-06 | ToMinutes counts from midnight |
| CLK-07 | ClockRange hands back values that are not times |

---

## How to read a failure

Each case is named for the behaviour it protects, not for the function it calls,
so a red line tells you what broke rather than where. Most carry a comment above
them naming the bug they were written for.

