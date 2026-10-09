import { useAsync } from '../lib/useAsync'
import { getRecommendations, findNextClass } from '../lib/recommend'
import Panel from './Panel'
import PageHeader from './PageHeader'
import Pill from './Pill'
import { ArrowRightIcon, ClockIcon, WalkIcon } from './icons'
import { BUSY_PERCENT, DAYS } from '../lib/time'
import { useDataVersion } from '../lib/useDataVersion'
import type { Recommendation } from '../types'

// Parking apps label why an option is in the list rather than printing a raw
// score, which reads far better than "74%". These come out of the same numbers.
function badges(lots: Recommendation[]) {
  const mark = new Map<string, string>()
  const walkable = lots.filter((l) => l.walk_minutes !== null)
  const closest = [...walkable].sort((a, b) => Number(a.walk_minutes) - Number(b.walk_minutes))[0]
  const pct = (l: Recommendation) => {
    const r = l.reasons.find((x) => x.includes('% full'))
    return r ? Number(r.replace(/\D+/g, '')) : 101
  }
  const emptiest = [...lots].sort((a, b) => pct(a) - pct(b))[0]
  if (lots[0]) mark.set(lots[0].id, 'Best overall')
  if (closest && !mark.has(closest.id)) mark.set(closest.id, 'Shortest walk')
  if (emptiest && !mark.has(emptiest.id)) mark.set(emptiest.id, 'Most space')
  return mark
}

// "ranked for CPSC 335, 09:00" with an arrive-by time of 08:42 reads as this
// morning even when the class is tomorrow.
function when(dayOffset: number, dayOfWeek: number) {
  if (dayOffset === 0) return ''
  if (dayOffset === 1) return ' tomorrow'
  return ` on ${DAYS[dayOfWeek] ?? 'a later day'}`
}

export default function ParkingView() {
  const version = useDataVersion()
  const recs = useAsync(getRecommendations, [version])
  const next = useAsync(findNextClass, [version])

  const heading = next.state === 'ready' && next.data
    ? `${next.data.course_code}, ${next.data.start_time}` +
      `${when(next.data.day_offset, next.data.day_of_week)} in ${next.data.building_name}`
    : 'your next class'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Parking">
        Every lot your permit allows, ranked for {heading}.
      </PageHeader>

      <Panel source={recs}>
        {(data) => {
          if (data.parking.length === 0) {
            return (
              <p className="rounded-xl border border-rule bg-paper px-5 py-6 text-sm text-ink-soft">
                No lots to rank. Add a class on your profile, or check your permit type.
              </p>
            )
          }
          const marks = badges(data.parking)
          return (
            <ul className="flex flex-col gap-3">
              {data.parking.map((lot, i) => {
                const fullness = lot.reasons.find((r) => r.includes('% full'))
                const pct = fullness ? Number(fullness.replace(/\D+/g, '')) : null
                const mark = marks.get(lot.id)
                return (
                  <li
                    key={lot.id}
                    className={
                      'rounded-xl border px-5 py-4 ' +
                      (i === 0 ? 'border-titan-200 bg-titan-50/60' : 'border-rule bg-white')
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {mark && <Pill tone="mark">{mark}</Pill>}
                          <Pill tone="match">{lot.match_percent}% match</Pill>
                        </div>

                        <h2 className={(i === 0 ? 'text-xl ' : 'text-base ') + 'mt-2 font-semibold text-titan'}>
                          {lot.title}
                        </h2>

                        <p className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
                          <span className="inline-flex items-center gap-1.5">
                            <WalkIcon className="h-4 w-4 text-ink-faint" />
                            {lot.walk_minutes !== null ? `${lot.walk_minutes} min walk` : 'walk unknown'}
                          </span>
                          {pct !== null && (
                            <span className="inline-flex items-center gap-2">
                              <span className="h-1.5 w-20 rounded-full bg-rule">
                                <span
                                  className={
                                    'block h-1.5 rounded-full ' + (pct >= BUSY_PERCENT ? 'bg-flame' : 'bg-titan')
                                  }
                                  style={{ width: `${pct}%` }}
                                />
                              </span>
                              usually {pct}% full
                            </span>
                          )}
                        </p>

                        {i === 0 && (
                          <p className="mt-2.5 text-xs text-ink-faint">
                            Scored on {lot.reasons.join(' · ')}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-5">
                        <div className="text-right">
                          <p className="flex items-center justify-end gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                            <ClockIcon className="h-3.5 w-3.5" />
                            {lot.arrive_by ? 'Arrive by' : 'Leave'}
                          </p>
                          <p className="mt-1 whitespace-nowrap text-2xl font-semibold tabular-nums tracking-tight text-titan">
                            {lot.arrive_by ?? 'now'}
                          </p>
                        </div>

                        {lot.lat !== null && lot.lng !== null && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${lot.lat},${lot.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className={
                              'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ' +
                              (i === 0
                                ? 'bg-titan text-white hover:bg-titan-700'
                                : 'border border-titan text-titan hover:bg-titan hover:text-white')
                            }
                          >
                            Directions
                            <ArrowRightIcon className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        }}
      </Panel>

      <p className="text-xs text-ink-faint">
        Occupancy is a typical pattern for that hour, not a live count. The five structures come
        from CSUF's availability board; the seven surface lots are our own estimates.
      </p>
    </div>
  )
}
