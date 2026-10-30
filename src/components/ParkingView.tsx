import { Suspense, lazy } from 'react'
import { useAsync } from '../lib/useAsync'
import { getRecommendations, findNextClass } from '../lib/recommend'
import Panel from './Panel'
import PageHeader from './PageHeader'
import Pill from './Pill'
import { ArrowRightIcon, ClockIcon, WalkIcon } from './icons'
import { BUSY_PERCENT, DAYS, clockText } from '../lib/time'
import { useDataVersion } from '../lib/useDataVersion'
import { useMinuteTick } from '../lib/useMinuteTick'
import { directionsUrl } from '../lib/maps'
import type { MapPoint } from './CampusMap'
import type { Recommendation } from '../types'

// Leaflet and its stylesheet are about a quarter of the whole bundle and this
// is the one screen that wants them, so they are fetched when somebody opens
// it rather than on the way to the dashboard. The type above is imported
// separately because a type import disappears at compile time and would
// otherwise drag the module back into the first download.
//
// The catch matters more than it looks. A tab left open across a deploy asks
// for a file name that no longer exists, and an import that rejects with
// nothing to catch it takes the whole screen down to a blank page. The list is
// the answer on this screen and the map is the illustration, so losing the
// list to the illustration is the wrong way round.
const CampusMap = lazy(() =>
  import('./CampusMap').catch(() => ({
    default: () => (
      <p className="rounded-xl border border-rule bg-paper px-4 py-6 text-center text-xs text-ink-faint">
        The map could not load. Everything it shows is in the list above.
      </p>
    ),
  })),
)

// A label for why an option is in the list, alongside the score rather than
// instead of it. "Shortest walk" is what somebody actually wants to know;
// "74%" is how it was worked out. Both come from the same numbers.
function badges(lots: Recommendation[]) {
  const mark = new Map<string, string>()
  const walkable = lots.filter((l) => l.walk_minutes !== null)
  const closest = [...walkable].sort((a, b) => Number(a.walk_minutes) - Number(b.walk_minutes))[0]
  // 101 for a lot with no reading, so it sorts behind every real one rather
  // than ahead of them as a zero would
  const pct = (l: Recommendation) => l.pct_full ?? 101
  const emptiest = [...lots].sort((a, b) => pct(a) - pct(b))[0]
  // "Best match" rather than "Best overall", because the events screen marks
  // its own top row that way and it is the same idea sitting next to the same
  // percentage on both screens.
  if (lots[0]) mark.set(lots[0].id, 'Best match')
  if (closest && !mark.has(closest.id)) mark.set(closest.id, 'Shortest walk')
  if (emptiest && !mark.has(emptiest.id)) mark.set(emptiest.id, 'Most space')
  return mark
}

// The scorer rounds the walk up to whole minutes, so a lot in the same
// building as the class comes back as 0 and this row read "0 min walk" next to
// the scorer's own reason "right by Computer Science". RecCard says the same
// thing at zero, and two screens wording one number two ways is worse than
// having the sentence written out twice.
function walkText(minutes: number | null) {
  if (minutes === null) return 'Walk time unknown'
  return minutes === 0 ? 'Less than a minute away' : `${minutes} min walk`
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
  // Both of these are worked out against the clock, and nothing bumps the data
  // version on the clock, so without the hour in here the ranking and the
  // arrive-by times stayed at whatever they were when the screen was opened.
  const minute = useMinuteTick()
  const recs = useAsync(getRecommendations, [version, minute])
  // On the minute, not the hour. Keyed on the hour, this screen kept saying
  // "ranked for CPSC 362, 11:30 AM" with "Be at lot by 11:07 AM" on every row
  // until noon, for a class that started at half past. The ranking is keyed on
  // which class is next, so asking every minute costs nothing until the class
  // actually changes.
  const next = useAsync(findNextClass, [version, minute])

  // The "in <building>" half is dropped when we do not know the building,
  // because findNextClass falls back to the word Campus for the name at the
  // same moment it falls back to zero for the coordinate. Printing the
  // fallback reads as a real place and it is not one.
  const heading = next.state === 'ready' && next.data
    ? `${next.data.course_code}, ${clockText(next.data.start_time)}`
      + when(next.data.day_offset, next.data.day_of_week)
      + (next.data.building_lat === 0 ? '' : ` in ${next.data.building_name}`)
    : 'your next class'

  // Where the walks are measured to, so the map shows what the ranking is
  // relative to rather than a scatter of lots. findNextClass falls back to
  // zero for a class whose building has gone missing, and a marker at 0, 0 is
  // in the Atlantic, which would zoom the map out to the whole world.
  const classPoint: MapPoint | null =
    next.state === 'ready' && next.data && next.data.building_lat !== 0
      ? {
          id: 'next-class',
          label: `${next.data.course_code} in ${next.data.building_name}`,
          lat: next.data.building_lat,
          lng: next.data.building_lng,
          tone: 'here',
        }
      : null

  return (
    <div className="flex flex-col gap-6">
      {/* The fullness caveat used to live in the footnote at the bottom, which
          is below a map that is 288px tall on a phone, so a student read
          "usually 41% full" and a "Most space" badge and never got to the part
          saying those come from a pattern rather than a camera. The badge is
          the worst of it, because it is phrased like something observed. The
          caveat belongs next to the sentence everybody reads; which lots CSUF
          counts stays at the bottom, because that is reference rather than
          something to act on. */}
      <PageHeader title="Parking">
        Every lot your permit allows, ranked for {heading}. The fullness numbers behind that
        order are a typical pattern for that hour, not a live count. The match percent is
        scored out of what we can judge for you, so nothing reaches a hundred.
      </PageHeader>

      <Panel source={recs}>
        {(data) => {
          if (data.parking.length === 0) {
            // Three reasons, not two. A class still on its way, or a request
            // that failed, is not the same thing as a schedule with nothing on
            // it, and reading it as one told a student to add a class when the
            // permit was the problem. Panel already has a line for each of
            // those two states and this is the same request, so it says them
            // rather than this guessing at a reason it does not have yet.
            if (next.state !== 'ready') {
              return <Panel source={next}>{() => null}</Panel>
            }
            // Past that, the schedule is known, and there are two more ways
            // to get here. A class whose building is no longer in the campus
            // data leaves nowhere to measure the walk to, and the ranking is
            // skipped rather than measured against a made up point, so say
            // that instead of blaming the permit. building_lat is zero in
            // that case, the same sentinel the map marker above reads.
            // Otherwise the permit is the only thing left that can have
            // emptied this.
            //
            // The course is named rather than the building, because the
            // building is exactly what we do not have here: its name has
            // already fallen back to the word Campus, and saying we cannot
            // find Campus on the campus map is nonsense.
            const unknownBuilding = next.data !== null && next.data.building_lat === 0
            return (
              <p className="rounded-xl border border-rule bg-paper px-5 py-6 text-sm text-ink-soft">
                {next.data === null
                  ? 'Nothing to show yet. Add a class on your profile and these fill in.'
                  : unknownBuilding
                    ? `No lots to rank, because we do not have a location for the building ${next.data.course_code} is in, so there is nowhere to measure the walk to. Everything else still works.`
                    : 'No lots to rank, because your profile does not say which permit you hold. Every lot takes some permits and not others.'}
              </p>
            )
          }
          const marks = badges(data.parking)
          const points: MapPoint[] = [
            ...(classPoint ? [classPoint] : []),
            ...data.parking.flatMap((lot, i) =>
              lot.lat !== null && lot.lng !== null
                ? [{
                    id: lot.id,
                    label: lot.title,
                    lat: lot.lat,
                    lng: lot.lng,
                    tone: (i === 0 ? 'pick' : 'rest') as MapPoint['tone'],
                  }]
                : []),
          ]
          return (
            <>
            <ul className="flex flex-col gap-3">
              {data.parking.map((lot, i) => {
                const pct = lot.pct_full
                const mark = marks.get(lot.id)
                return (
                  <li
                    key={lot.id}
                    className={
                      'rounded-xl border px-5 py-4 ' +
                      (i === 0 ? 'border-titan-200 bg-titan-50' : 'border-rule bg-white')
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {mark && <Pill tone="mark">{mark}</Pill>}
                          <Pill tone="match">{lot.match_percent}% match</Pill>
                        </div>

                        {/* The lot is the answer to the question this screen
                            asks, and the arrive-by time on the right is a
                            qualifier on it, so the name sits one size step
                            above the time on every row. The next class card
                            puts a course code over its countdown the same
                            way. */}
                        <h2 className={(i === 0 ? 'text-2xl ' : 'text-lg ') + 'mt-2 font-semibold text-titan'}>
                          {lot.title}
                        </h2>

                        <p className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
                          <span className="inline-flex items-center gap-1.5">
                            <WalkIcon className="h-4 w-4 text-ink-faint" />
                            {walkText(lot.walk_minutes)}
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
                              {/* The bar turning orange is otherwise the only
                                  thing saying this lot counts as busy, and a
                                  color on its own is not a cue for everyone.
                                  The rail does the same beside its own number.
                                  The word is busy and not full because the
                                  number right before it already says full. */}
                              {pct >= BUSY_PERCENT && (
                                <span className="font-semibold text-flame-ink">busy</span>
                              )}
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
                          {/* "Arrive by" never said arrive where. The scorer
                              works this out as the class start minus the walk
                              minus a buffer for circling the lot, so it is the
                              time to be at the lot, and the 11 min walk on the
                              left is already taken off. Read as the time to be
                              at class it is 11 minutes late, which is the one
                              thing this screen exists to stop. Kept to four
                              short words because this slot is uppercase at
                              0.7rem and sits beside the Directions button.
                              RecCard and NextClassCard print the same number
                              and have to say the same thing. */}
                          <p className="flex items-center justify-end gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                            <ClockIcon className="h-3.5 w-3.5" />
                            {lot.arrive_by ? 'Be at lot by' : 'Leave'}
                          </p>
                          <p
                            className={
                              (i === 0 ? 'text-xl ' : 'text-base ') +
                              'mt-1 whitespace-nowrap font-semibold tabular-nums tracking-tight text-titan'
                            }
                          >
                            {lot.arrive_by ? clockText(lot.arrive_by) : 'now'}
                          </p>
                        </div>

                        {lot.lat !== null && lot.lng !== null && (
                          <a
                            href={directionsUrl(lot.title, lot.lat, lot.lng)}
                            target="_blank"
                            rel="noreferrer noopener"
                            // Ten lots means ten links, and a screen reader
                            // reading them as a list of ten rows all saying
                            // Directions is no use. The visible word stays
                            // inside the label it is read by.
                            aria-label={`Directions to ${lot.title}`}
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

            {/* After the list, not before it. The list is the answer; this is
                for working out where the answer actually is. */}
            <Suspense
              fallback={
                <p className="rounded-xl border border-rule bg-paper px-4 py-6 text-center text-xs text-ink-faint">
                  Loading the map…
                </p>
              }
            >
              <CampusMap
                points={points}
                caption={
                  'Orange is the top pick, pale blue the other lots' +
                  (classPoint ? ', navy where your class is.' : '.')
                }
              />
            </Suspense>
            </>
          )
        }}
      </Panel>

      <p className="text-xs text-ink-faint">
        CSUF counts the four structures, and counts S8 and S10 together. We read its board
        twice and fitted the hour by hour pattern ourselves, so the shape of the day is our
        work rather than a published figure. The employee, resident and hourly lots it does
        not count at all, so those are estimates.
      </p>
    </div>
  )
}
