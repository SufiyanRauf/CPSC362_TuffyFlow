import type { Building, ClassMeeting, RecommendResponse, Spot } from '../types'
import {
  getAvailabilityAround, getBuildings, getClassMeetings, getEvents,
  getParkingLots, getProfile, getSpots,
} from './campusData'
import { dataVersion } from './dataVersion'

const CAMPUS_TZ = 'America/Los_Angeles'

// The browser's own clock is wherever the laptop is. Everything here has to be
// campus local or the arrival hour lookup shifts and the numbers quietly change.
// Built once. The formatter is the expensive half, and campusParts below runs
// three times for every event in a ranking, so rebuilding it there was most of
// the time this file spent. Safe to share: both of these read only the literal
// options and the module's timezone, and the only thing that changes per call
// is the date handed to formatToParts.
const NOW_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
})

const PARTS_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAMPUS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

export function campusNow() {
  const parts = NOW_FORMAT.formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    dayOfWeek: days.indexOf(get('weekday')),
    minutes: Number(get('hour')) % 24 * 60 + Number(get('minute')),
  }
}

// Everything the scorer compares has to be in campus time. campusNow already
// does that for the clock; this does it for an event's own date, which used to
// be read with getHours() in whatever timezone the laptop happened to be in.
function campusParts(when: Date) {
  const parts = PARTS_FORMAT.formatToParts(when)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) % 24 * 60 + Number(get('minute')),
  }
}

function daysBetween(fromISODate: string, toISODate: string) {
  const a = Date.parse(`${fromISODate}T00:00:00Z`)
  const b = Date.parse(`${toISODate}T00:00:00Z`)
  return Math.round((b - a) / 86400000)
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Split out from findNextClass so that getRecommendations can work it out
// from rows it has already fetched. It used to call findNextClass, which did
// its own fetch, and then fetch everything else in a second round. Signing in
// between the two rounds meant the class came from the sample campus and the
// buildings came from the database, and since nothing joined across the two, every
// spot and every event was dropped and the dashboard looked like a working
// account with nothing to recommend. Everything that has to join now comes
// out of one round. The occupancy rows still follow in a second, because
// which ones to ask for depends on when the class is; the comment down there
// says what that costs.
function nextClassFrom(meetings: ClassMeeting[], buildings: Building[]) {
  const { dayOfWeek, minutes } = campusNow()

  const upcoming = meetings.map((m) => {
    const start = toMinutes(m.start_time)
    let daysAhead: number
    if (m.day_of_week === dayOfWeek && start > minutes) {
      daysAhead = 0
    } else {
      daysAhead = (m.day_of_week - dayOfWeek + 7) % 7
      if (daysAhead === 0) daysAhead = 7
    }
    // Counted in calendar days, not minutes divided by 1440. Saturday 23:00 to
    // a Monday 10:00 class is two days ahead but only 2100 minutes away, so
    // dividing the gap by 1440 would call it one.
    return { meeting: m, until: daysAhead * 1440 + start - minutes, start, daysAhead }
  })

  upcoming.sort((a, b) => a.until - b.until)
  const next = upcoming[0]
  if (!next) return null

  const building = buildings.find((b) => b.id === next.meeting.building_id)
  return {
    course_code: next.meeting.course_code,
    start_time: next.meeting.start_time.slice(0, 5),
    building_id: next.meeting.building_id,
    building_name: building?.name ?? 'Campus',
    building_lat: building?.lat ?? 0,
    building_lng: building?.lng ?? 0,
    start_minutes: next.start,
    minutes_until: next.until,
    day_of_week: next.meeting.day_of_week,
    day_offset: next.daysAhead,
  }
}

// A spot with no hours at all is one we do not know about, which the scorer
// treats as open rather than guessing. A spot with hours but not for today is
// shut today, and saying so is the whole reason the hours are per day.
function todaysHours(spot: Spot, day: number) {
  const known = Object.keys(spot.hours).length > 0
  const today = spot.hours[day]
  if (!known) return { opens_at: null, closes_at: null, closed_today: false }
  if (!today) return { opens_at: null, closes_at: null, closed_today: true }
  return { opens_at: today[0], closes_at: today[1], closed_today: false }
}

function assertResponse(json: unknown): RecommendResponse {
  const r = json as RecommendResponse
  if (!r || !Array.isArray(r.parking) || !Array.isArray(r.spots) || !Array.isArray(r.events)) {
    throw new Error('The scorer returned something unexpected')
  }
  return r
}

export async function findNextClass() {
  const [meetings, buildings] = await Promise.all([getClassMeetings(), getBuildings()])
  return nextClassFrom(meetings, buildings)
}

// Only ever reached when the next class's building is missing from the list,
// and only in fields the scorer reads for the parking walk. It is here because
// 0, 0 is not a stand-in for a place we do not know: it is a real point in the
// Gulf of Guinea, and this way a stray reading of these numbers is at least on
// the right continent.
const CAMPUS_MIDDLE = { lat: 33.8816, lng: -117.8854 }

async function loadRecommendations(): Promise<RecommendResponse> {
  // Everything the ranking needs, in one go, so it is all from whichever
  // source answered first.
  const [profile, lots, spots, events, buildings, meetings] = await Promise.all([
    getProfile(), getParkingLots(), getSpots(), getEvents(), getBuildings(), getClassMeetings(),
  ])

  const next = nextClassFrom(meetings, buildings)
  if (!next) // Nothing to rank against is an empty result, not a failure. Deleting every
    // class on the profile screen used to put an error box on three screens.
    return { parking: [], spots: [], events: [] }

  const { dayOfWeek, minutes } = campusNow()
  const arrivalHour = Math.floor(
    Math.max(0, next.start_minutes - 20) / 60,
  )
  const where = (id: string) => buildings.find((b) => b.id === id)

  // Where the walk to class gets measured to. A class whose building has gone
  // from the list leaves us without one, and the scorer cannot tell a made up
  // destination from a real one: given 0, 0 it measured the walk anyway and
  // ranked every lot at 203913 minutes with an arrive-by time next to it,
  // which is a 141 day walk offered as a plan. A spot or an event with nowhere
  // to measure from already scores a neutral walk and says so on the card.
  // Parking has no such reading to fall back on, so with no destination the
  // lots are left out below and that ranking comes back empty rather than
  // invented.
  const dest = where(next.building_id)

  // The one query that has to wait, because which rows to ask for depends on
  // when the class is. Worst case it answers from the other source, and since
  // the seed writes campus documents at the sample rows' own ids, those would
  // quietly join rather than visibly fail. Not reachable today: every change
  // of person remounts the tree, so nothing survives across one.
  //
  // Skipped without a destination, because the parking ranking is the only
  // thing that reads these rows and there is no parking ranking to make.
  const availability = dest
    ? await getAvailabilityAround(next.day_of_week, arrivalHour)
    : []

  const body = {
    profile: {
      permit_type: profile.permit_type,
      noise_pref: profile.noise_pref,
      interests: profile.interests,
      career_goals: profile.career_goals,
    },
    dest_lat: dest?.lat ?? CAMPUS_MIDDLE.lat,
    dest_lng: dest?.lng ?? CAMPUS_MIDDLE.lng,
    dest_name: next.building_name,
    now_minutes: minutes,
    day_of_week: dayOfWeek,
    arrival_hour: arrivalHour,
    class_start_minutes: next.start_minutes,
    class_day_offset: next.day_offset,
    lots: dest
      ? lots.map((l) => ({
        id: l.id, name: l.name, lat: l.lat, lng: l.lng, permits: l.permits,
      }))
      : [],
    availability,
    spots: spots.flatMap((s) => {
      const b = where(s.building_id)
      if (!b) return []
      return [{
        id: s.id, name: s.name, kind: s.kind, lat: b.lat, lng: b.lng,
        noise_level: s.noise_level, has_outlets: s.has_outlets,
        // Today's hours only, worked out here so the scorer keeps taking one
        // pair of times. closed_today is what tells it the difference between
        // somewhere shut today and somewhere whose hours we never knew: the
        // second is not a reason to rule a place out, and the first is.
        ...todaysHours(s, dayOfWeek),
      }]
    }),
    events: events.flatMap((e) => {
      const b = where(e.building_id)
      if (!b) return []
      const start = campusParts(new Date(e.starts_at))
      const end = campusParts(new Date(e.ends_at))
      const todayOnCampus = campusParts(new Date()).date
      return [{
        id: e.id, name: e.title, lat: b.lat, lng: b.lng,
        tags: e.tags,
        starts_minutes: start.minutes,
        ends_minutes: end.minutes,
        day_offset: daysBetween(todayOnCampus, start.date),
      }]
    }),
    // Every meeting, with its day and its building. The day is what stops an
    // event on a later day skipping the clash check; the building is what lets
    // a walk be measured from wherever you actually are that day rather than
    // from whatever your next class happens to be.
    class_meetings: meetings.map((m) => {
      const b = where(m.building_id)
      return {
        day_of_week: m.day_of_week,
        start: toMinutes(m.start_time),
        end: toMinutes(m.end_time),
        lat: b?.lat ?? null,
        lng: b?.lng ?? null,
        building_name: b?.name ?? null,
      }
    }),
  }

  let res: Response
  try {
    res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // A request that never got anywhere rejects rather than returning a
    // status. Everything read out of Firestore already turns this into a
    // sentence, and without the same thing here the same outage would read
    // properly everywhere except on whatever is showing a ranking.
    throw new Error('Could not reach the server. Check your connection and try again.')
  }
  if (!res.ok) {
    // 404 is the deployed case, where the Python function did not build or is
    // not routed. 502 is the local one: the dev server proxies to uvicorn and
    // answers with that when nothing is listening, which is what you get
    // having started only half the app.
    throw new Error(
      res.status === 404 || res.status === 502
        ? 'The scoring service is not answering. Start it with: '
          + '.venv/bin/python -m uvicorn api.recommend:app --port 8000'
        : `The scoring service returned ${res.status}`,
    )
  }
  return assertResponse(await res.json())
}

// The ranking is the most expensive thing the app does, and one screen asks
// for it twice: the dashboard panel and the events rail both call it, as do
// the parking screen and that same rail, so drawing one screen was two full
// rounds of reads and two posts to the scorer. campusData holds the campus
// lists the same way and for the same reason, which is that Firestore charges
// by the document read and the free tier is about 50,000 a day.
//
// Keyed on dataVersion() and the campus hour together. dataVersion() is the
// app's signal that the rows behind a screen have moved on, so a write or a
// sign in cannot be served a ranking from before it, and the hour is what the
// ranking is worked out against: which occupancy row to read, which events
// have not started yet, how long until the class. The hour rather than the
// minute because that is what the screens already depend on.
//
// The campus date is in the key as well, because the hour on its own is 0 to
// 23 and repeats. A tab left open overnight asked at the same clock hour the
// next day and got a byte-identical key, so yesterday's ranking was handed
// back: dataVersion() only moves on a write or a sign in, and an idle tab does
// neither. Both halves come from one campusParts call so the date and the hour
// cannot disagree across a rollover.
let rankedFor = ''
let ranked: Promise<RecommendResponse> | null = null

export function getRecommendations(): Promise<RecommendResponse> {
  const today = campusParts(new Date())
  const asked = `${dataVersion()}:${today.date}:${Math.floor(today.minutes / 60)}`
  if (asked !== rankedFor) {
    rankedFor = asked
    ranked = null
  }

  if (!ranked) {
    // The promise, not the response, so the panels asking at the same moment
    // share one request instead of starting several.
    //
    // Dropped on failure for the same reason campusData drops a failed read:
    // keeping a rejected promise means one request off bad wifi keeps failing
    // for the life of the page even after the network comes back. Only if the
    // key has not moved on, so a late rejection cannot throw away a newer one.
    ranked = loadRecommendations().catch((e: unknown) => {
      if (rankedFor === asked) ranked = null
      throw e
    })
  }
  return ranked
}
