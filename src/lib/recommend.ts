import type { RecommendResponse } from '../types'
import {
  getAvailabilityAround, getBuildings, getClassMeetings, getEvents,
  getParkingLots, getProfile, getSpots,
} from './campusData'

const CAMPUS_TZ = 'America/Los_Angeles'

// The browser's own clock is wherever the laptop is. Everything here has to be
// campus local or the arrival hour lookup shifts and the numbers quietly change.
export function campusNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPUS_TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    dayOfWeek: days.indexOf(get('weekday')),
    minutes: Number(get('hour')) % 24 * 60 + Number(get('minute')),
  }
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export async function findNextClass() {
  const [meetings, buildings] = await Promise.all([getClassMeetings(), getBuildings()])
  const { dayOfWeek, minutes } = campusNow()

  const upcoming = meetings.map((m) => {
    const start = toMinutes(m.start_time)
    let until: number
    if (m.day_of_week === dayOfWeek && start > minutes) {
      until = start - minutes
    } else {
      let daysAhead = (m.day_of_week - dayOfWeek + 7) % 7
      if (daysAhead === 0) daysAhead = 7
      until = daysAhead * 1440 + start - minutes
    }
    return { meeting: m, until, start }
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
  }
}

function assertResponse(json: unknown): RecommendResponse {
  const r = json as RecommendResponse
  if (!r || !Array.isArray(r.parking) || !Array.isArray(r.spots) || !Array.isArray(r.events)) {
    throw new Error('The scorer returned something unexpected')
  }
  return r
}

export async function getRecommendations(): Promise<RecommendResponse> {
  const next = await findNextClass()
  if (!next) throw new Error('No classes on the schedule')

  const { dayOfWeek, minutes } = campusNow()
  const arrivalHour = Math.floor(
    Math.max(0, next.start_minutes - 20) / 60,
  )

  const [profile, lots, availability, spots, events, buildings, meetings] = await Promise.all([
    getProfile(), getParkingLots(), getAvailabilityAround(dayOfWeek, arrivalHour),
    getSpots(), getEvents(), getBuildings(), getClassMeetings(),
  ])
  const where = (id: string) => buildings.find((b) => b.id === id)

  const body = {
    profile: {
      permit_type: profile.permit_type,
      noise_pref: profile.noise_pref,
      interests: profile.interests,
      career_goals: profile.career_goals,
    },
    dest_lat: next.building_lat,
    dest_lng: next.building_lng,
    dest_name: next.building_name,
    now_minutes: minutes,
    day_of_week: dayOfWeek,
    arrival_hour: arrivalHour,
    class_start_minutes: next.start_minutes,
    lots: lots.map((l) => ({
      id: l.id, name: l.name, lat: l.lat, lng: l.lng, permit_type: l.permit_type,
    })),
    availability,
    spots: spots.map((s) => ({
      id: s.id, name: s.name,
      lat: where(s.building_id)?.lat ?? 0, lng: where(s.building_id)?.lng ?? 0,
      noise_level: s.noise_level, has_outlets: s.has_outlets,
      opens_at: s.opens_at, closes_at: s.closes_at,
    })),
    events: events.map((e) => {
      const start = new Date(e.starts_at)
      const end = new Date(e.ends_at)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dayOffset = Math.round((new Date(start).setHours(0, 0, 0, 0) - today.getTime()) / 86400000)
      return {
        id: e.id, name: e.title,
        lat: where(e.building_id)?.lat ?? 0, lng: where(e.building_id)?.lng ?? 0,
        tags: e.tags,
        starts_minutes: start.getHours() * 60 + start.getMinutes(),
        ends_minutes: end.getHours() * 60 + end.getMinutes(),
        day_offset: dayOffset,
      }
    }),
    todays_classes: meetings
      .filter((m) => m.day_of_week === dayOfWeek)
      .map((m) => ({ start: toMinutes(m.start_time), end: toMinutes(m.end_time) })),
  }

  const res = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? 'The scorer is not running. Start it with: PYTHONPATH=api uvicorn api.recommend:app --port 8000'
        : `The scorer returned ${res.status}`,
    )
  }
  return assertResponse(await res.json())
}
