import { useAsync } from '../lib/useAsync'
import { getBuildings, getEvents } from '../lib/campusData'
import { getRecommendations } from '../lib/recommend'
import { useMinuteTick } from '../lib/useMinuteTick'
import { useDataVersion } from '../lib/useDataVersion'
import Panel from './Panel'
import { CAMPUS_TZ, campusDate } from '../lib/time'

// Reads the scored events, not the raw list. The raw list still contains the
// ones that clash with a class, so the rail was offering something the events
// screen then refused to show.
async function upcoming() {
  const [recs, events, buildings] = await Promise.all([
    getRecommendations(), getEvents(), getBuildings(),
  ])
  const byId = new Map(events.map((e) => [e.id, e]))
  const where = new Map(buildings.map((b) => [b.id, b.name]))
  const today = campusDate(new Date())

  return recs.events
    .map((r) => byId.get(r.id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 5)
    .map((e) => {
      const start = new Date(e.starts_at)
      return {
        id: e.id,
        title: e.title,
        host: e.club_name,
        where: where.get(e.building_id) ?? 'Campus',
        // same wording as the events screen, so the two never disagree
        when: new Intl.DateTimeFormat('en-US', {
          timeZone: CAMPUS_TZ, weekday: 'short', hour: 'numeric', minute: '2-digit',
        }).format(start),
        isToday: campusDate(start) === today,
      }
    })
}

// Cards rather than rows, because this sits in the narrow rail where a row with
// four columns would wrap into mush.
export default function UpcomingEvents() {
  const events = useAsync(upcoming, [useMinuteTick(), useDataVersion()])

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
                <span className="shrink-0 whitespace-nowrap rounded bg-titan-50 px-1.5 py-0.5 text-[0.65rem] font-semibold text-titan">
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
