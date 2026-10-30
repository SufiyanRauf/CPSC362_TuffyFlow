import { useAsync } from '../lib/useAsync'
import { getBuildings, getEvents } from '../lib/campusData'
import { getRecommendations } from '../lib/recommend'
import { useCampusHour } from '../lib/useMinuteTick'
import { useDataVersion } from '../lib/useDataVersion'
import Panel from './Panel'
import { CAMPUS_TZ, campusDate } from '../lib/time'

// Reads the scored events, not the raw list. The raw list still contains the
// ones that clash with a class, so the rail was offering something the events
// screen then refused to show.
// AM/PM, like the class and arrive-by times on the rest of the dashboard,
// which sits next to this rail at wide widths. Both are built once instead of
// per event, because the formatter is the expensive part and neither depends
// on anything but the date it is handed.
const EVENT_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TZ, hour: 'numeric', minute: '2-digit', hour12: true,
})

const EVENT_DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TZ, weekday: 'short',
})

async function upcoming() {
  const [recs, events, buildings] = await Promise.all([
    getRecommendations(), getEvents(), getBuildings(),
  ])
  const byId = new Map(events.map((e) => [e.id, e]))
  const where = new Map(buildings.map((b) => [b.id, b.name]))
  const today = campusDate(new Date())
  // Counted off today's date rather than by adding 24 hours, because on the
  // morning the clocks go back a naive +24h still lands on today and the word
  // Tomorrow disappears for an hour. Noon UTC is the small hours here, so it
  // never lands on the wrong date. Same helper shape as the events screen,
  // which is where this has to agree with.
  const [y, m, d] = today.split('-').map(Number)
  const tomorrow = campusDate(new Date(Date.UTC(y, m - 1, d + 1, 12)))

  return recs.events
    .map((r) => byId.get(r.id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 5)
    .map((e) => {
      const start = new Date(e.starts_at)
      const stamp = campusDate(start)
      const isToday = stamp === today
      const time = EVENT_TIME.format(start)
      const day = EVENT_DAY.format(start)
      return {
        id: e.id,
        title: e.title,
        host: e.club_name,
        where: where.get(e.building_id) ?? 'Campus',
        // The stripe going orange is the only other cue, and "Tue" alone does
        // not say whether that is today or next week. "Today" costs no width.
        when: `${isToday ? 'Today' : stamp === tomorrow ? 'Tomorrow' : day}, ${time}`,
        isToday,
      }
    })
}

// Cards rather than rows, because this sits in the narrow rail where a row with
// four columns would wrap into mush.
export default function UpcomingEvents() {
  // The hour. This one reads the scored events, which means a whole round of
  // recommendations and a request to the scorer, so it was the expensive part
  // of refetching every minute: 115 documents and a POST, to notice that an
  // event starting at half past had started.
  const events = useAsync(upcoming, [useCampusHour(), useDataVersion()])

  return (
    <Panel source={events} empty="Nothing coming up.">
      {(rows) => (
        <ul className="flex flex-col gap-2.5">
          {rows.map((e) => (
            <li
              key={e.id}
              className={
                'rounded-lg border border-l-4 border-rule bg-white p-3 ' +
                (e.isToday ? 'border-l-flame' : 'border-l-titan-200')
              }
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium leading-snug text-titan">{e.title}</h3>
                {/* This badge is the only thing in the rail saying when, so it
                    was the wrong place to be the smallest text on the screen.
                    rounded-md rather than rounded, which is what every other
                    badge and pill in the app uses. */}
                <span className="shrink-0 whitespace-nowrap rounded-md bg-titan-50 px-1.5 py-0.5 text-[0.7rem] font-semibold text-titan">
                  {e.when}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-ink-soft">{e.host}</p>
              <p className="text-xs text-ink-faint">{e.where}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
