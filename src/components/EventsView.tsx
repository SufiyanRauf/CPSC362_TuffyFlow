import { useAsync } from '../lib/useAsync'
import { getRecommendations } from '../lib/recommend'
import { getBuildings, getEvents } from '../lib/campusData'
import Panel from './Panel'
import PageHeader from './PageHeader'
import Pill from './Pill'
import { ClockIcon, PinIcon, UsersIcon, WalkIcon } from './icons'
import { CAMPUS_TZ } from '../lib/time'
import { useDataVersion } from '../lib/useDataVersion'

// The three things the walk factor can say. The card prints the minutes
// itself, so this is only here to carry what they are measured from.
const WALK_REASON = /^(measured from |right by |no class )/

// The scorer already ranks every event and the dashboard was showing only the
// top one, so the rest of that work was being thrown away.
async function rankedEvents() {
  const [recs, events, buildings] = await Promise.all([
    getRecommendations(), getEvents(), getBuildings(),
  ])
  const byId = new Map(events.map((e) => [e.id, e]))
  const where = new Map(buildings.map((b) => [b.id, b.name]))
  return recs.events.map((r) => {
    const e = byId.get(r.id)
    const start = e ? new Date(e.starts_at) : null
    const when = start
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: CAMPUS_TZ, weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        }).format(start)
      : ''
    return {
      id: r.id,
      title: r.title,
      match: r.match_percent,
      reasons: r.reasons,
      host: e?.club_name ?? '',
      tags: e?.tags ?? [],
      where: e ? where.get(e.building_id) ?? '' : '',
      when,
      walk: r.walk_minutes,
      measuredFrom: r.reasons.find((x) => WALK_REASON.test(x)) ?? '',
    }
  })
}

export default function EventsView() {
  const events = useAsync(rankedEvents, [useDataVersion()])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Events">
        Ranked on how well the tags match your interests, how far it is from your classes
        that day, and how soon it
        starts. Anything clashing with one of your classes is left out.
      </PageHeader>

      <Panel source={events} empty="Nothing upcoming that fits around your classes.">
        {(rows) => (
          <ul className="flex flex-col gap-3">
            {rows.map((e, i) => (
              <li
                key={e.id}
                className={
                  'rounded-xl border px-5 py-4 ' +
                  (i === 0 ? 'border-titan-200 bg-titan-50/60' : 'border-rule bg-white')
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                  <div className="min-w-0">
                    {i === 0 && (
                      <p className="mb-2">
                        <Pill tone="mark">Best match</Pill>
                      </p>
                    )}
                    <h2 className={(i === 0 ? 'text-lg ' : 'text-base ') + 'font-semibold text-titan'}>
                      {e.title}
                    </h2>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
                      <span className="inline-flex items-center gap-1.5">
                        <ClockIcon className="h-4 w-4 text-ink-faint" />
                        {e.when}
                      </span>
                      {e.where && (
                        <span className="inline-flex items-center gap-1.5">
                          <PinIcon className="h-4 w-4 text-ink-faint" />
                          {e.where}
                        </span>
                      )}
                      {e.walk !== null && (
                        <span className="inline-flex items-center gap-1.5">
                          <WalkIcon className="h-4 w-4 text-ink-faint" />
                          {e.walk} min walk
                        </span>
                      )}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-faint">
                      <UsersIcon className="h-4 w-4" />
                      {e.host}
                    </p>
                    {/* what the walk is measured from, or that nothing on that
                        day says where you would be starting from */}
                    {e.measuredFrom && (
                      <p className="mt-1 text-sm text-ink-faint">{e.measuredFrom}</p>
                    )}
                  </div>

                  <Pill tone="match">{e.match}% match</Pill>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.tags.map((t) => (
                    <span key={t} className="rounded-md bg-titan-50 px-2 py-0.5 text-xs text-ink-soft">
                      {t}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="text-xs text-ink-faint">
        Events are the one part of this data we made up. The clubs hosting them are real.
      </p>
    </div>
  )
}
