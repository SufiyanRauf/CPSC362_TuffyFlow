import { useEffect, useRef, useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { useDataVersion } from '../lib/useDataVersion'
import { getSpots } from '../lib/campusData'
import type { Spot, SpotKind } from '../types'
import Panel from './Panel'
import PageHeader from './PageHeader'
import { noiseText, noiseWords, spotKindLabels } from '../lib/labels'
import { campusNow } from '../lib/recommend'
import { useCampusHour } from '../lib/useMinuteTick'

// The screen does two jobs, somewhere to work and somewhere to eat, so the
// control that picks between them says exactly that. It used to be a dropdown
// of five kinds, where two of the five had one row each and the real decision
// was buried among them.
//
// Work covers the group study rooms and the Student Genius Center as well as
// the library floors, because all three are places you sit down and get
// something done. Nothing is hidden by the grouping: every card still shows
// its own kind, so a group study room still says "Meet up" on it.
type Kind = 'any' | 'work' | 'eat'

// An empty kinds list means every kind, so "Both" does not have to list them.
const VIEWS: { id: Kind; label: string; kinds: SpotKind[] }[] = [
  { id: 'any', label: 'Both', kinds: [] },
  { id: 'work', label: 'Study spots', kinds: ['study', 'meet', 'charge'] },
  { id: 'eat', label: 'Food', kinds: ['eat'] },
]

function kindsFor(view: Kind): SpotKind[] {
  return VIEWS.find((v) => v.id === view)?.kinds ?? []
}

// Shut today, which is most of the food on a weekend. This screen is for
// browsing rather than for being told where to go now, so a place that is
// closed stays on the list and says so. Hiding it would be worse: you cannot
// plan a Monday on a Sunday if Monday's options are invisible.
function closedToday(hours: Spot['hours'], day: number) {
  return Object.keys(hours).length > 0 && !hours[day]
}

// Which filters are doing something, in the words printed beside them. Three
// controls can each empty the list on their own, and "no spots match these
// filters" does not say which one to move, so the empty state names them.
function activeFilters(kind: Kind, maxNoise: number, outletsOnly: boolean) {
  const on: string[] = []
  if (kind !== 'any') on.push(VIEWS.find((v) => v.id === kind)?.label ?? kind)
  if (maxNoise < 5) on.push(`noise up to ${maxNoise} of 5`)
  if (outletsOnly) on.push('outlets only')
  return on
}

// The sentence a reader gets, held back until the controls stop moving. A live
// region whose text changes on every step of the slider reads out four numbers
// nobody asked for on the way to the one they did, so this waits for the
// dragging to stop and then says the answer once.
function useSettled(text: string) {
  const [settled, setSettled] = useState(text)
  useEffect(() => {
    const waiting = setTimeout(() => setSettled(text), 400)
    return () => clearTimeout(waiting)
  }, [text])
  return settled
}

export default function SpotsView() {
  const [kind, setKind] = useState<Kind>('any')
  const [maxNoise, setMaxNoise] = useState(5)
  const [outletsOnly, setOutletsOnly] = useState(false)
  // every other loader in the app takes the version. Without it this keeps
  // whichever account's fetch it started with, and a first fetch that failed
  // is never tried again.
  const spots = useAsync(getSpots, [useDataVersion()])
  // Reset has to hand focus somewhere, because the button takes itself off the
  // page when you press it. It goes to the first filter, not to the sr-only
  // count line: that line is zero sized, so a sighted keyboard user would get
  // no ring and lose their place. The clubs screen hands focus to its search
  // box for the same reason, and this screen has no search box.
  const kindRef = useRef<HTMLButtonElement>(null)

  function reset() {
    setKind('any')
    setMaxNoise(5)
    setOutletsOnly(false)
    kindRef.current?.focus()
  }
  // Subscribed to the tick like every other screen that shows something
  // time dependent. Read once it never changed again, so a tab left open
  // across midnight kept yesterday's "Closed today" badges.
  useCampusHour()
  const today = campusNow().dayOfWeek

  // The filtering moved up here out of the panel below, because the status
  // line has to sit outside the panel to survive the list emptying, and it
  // needs the counts. The panel still decides what is drawn.
  const all = spots.state === 'ready' ? spots.data : []
  const visible = all.filter(
    (s) =>
      (kind === 'any' || kindsFor(kind).includes(s.kind)) &&
      s.noise_level <= maxNoise &&
      (!outletsOnly || s.has_outlets),
  )
  const on = activeFilters(kind, maxNoise, outletsOnly)
  const emptyLine = on.length > 0
    ? `Nothing matches ${on.join(', ')}.`
    : 'Nothing matches these filters.'
  const countLine = `Showing ${visible.length} of ${all.length} spots`
  // The line is only drawn while something is actually filtering, because
  // nothing here is capped and "Showing 24 of 24" on arrival is a sentence
  // with no information in it. The announcement keeps it either way: a screen
  // reader user arriving on the screen does want to know how many there are,
  // and they cannot see the list to count it.
  const shownLine = on.length > 0 ? countLine : ''
  const announced = useSettled(
    all.length === 0 ? '' : visible.length === 0 ? emptyLine : countLine,
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Spots">
        Somewhere to work, eat or meet between classes.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-rule
                      bg-paper px-4 py-3 text-sm">
        {/* rule-strong and min-h-11, same as the fields on the profile screen.
            Plain rule is a card edge and manages 1.3:1 on white, so the
            outline on this was not there at all, and without the height it
            stood a centimetre shorter than the two labels beside it. */}
        {/* Three buttons rather than a dropdown, because this is the first
            decision a student makes and it is worth being able to see all of
            it at once. The counts are on the labels so nobody picks an option
            that has nothing behind it, the same way the clubs interest menu
            names its counts. */}
        <div role="group" aria-label="Which spots to show" className="flex flex-wrap gap-1.5">
          {VIEWS.map((v, i) => {
            const picked = kind === v.id
            // Counted against the noise and outlet filters too, not just the
            // whole list. Off `all` the Food button read "Food (16)" with the
            // noise slider at 1, and pressing it gave "Nothing matches Food,
            // noise up to 1 of 5", which is the opposite of what a count on a
            // label is for.
            const n = all.filter(
              (sp) =>
                (v.kinds.length === 0 || v.kinds.includes(sp.kind)) &&
                sp.noise_level <= maxNoise &&
                (!outletsOnly || sp.has_outlets),
            ).length
            return (
              <button
                key={v.id}
                ref={i === 0 ? kindRef : undefined}
                type="button"
                onClick={() => setKind(v.id)}
                aria-pressed={picked}
                className={
                  'min-h-11 rounded-md border px-3 text-sm font-medium ' +
                  (picked
                    ? 'border-titan bg-titan text-white'
                    : 'border-rule-strong text-titan hover:border-titan')
                }
              >
                {v.label}{all.length > 0 && <span className="tabular-nums"> ({n})</span>}
              </button>
            )
          })}
        </div>

        <label className="flex min-h-11 items-center gap-2">
          Noise up to
          {/* The visible words have to be the start of the name, or voice
              control has nothing to match: someone saying "click noise up to"
              was hitting a control whose name began "loudest noise level",
              and the command failed without saying why. The profile screen
              names its slider the same way. */}
          <input
            className="h-6"
            type="range" min={1} max={5} value={maxNoise}
            onChange={(e) => setMaxNoise(Number(e.target.value))}
            aria-label="Noise up to, the loudest noise level to show, 1 is quietest"
            aria-valuetext={`${maxNoise} of 5, ${noiseWords[maxNoise]}`}
          />
          <span className="text-ink-soft">
            <span className="tabular-nums">{maxNoise} of 5</span>, {noiseWords[maxNoise]}
          </span>
        </label>

        <label className="flex min-h-11 items-center gap-2">
          <input
            className="h-5 w-5"
            type="checkbox" checked={outletsOnly}
            onChange={(e) => setOutletsOnly(e.target.checked)}
          />
          Outlets only
        </label>

        {on.length > 0 && (
          // underlined always, not on hover: navy and a heavier weight are the
          // only things setting this apart from the words beside it otherwise,
          // and colour on its own is not a difference everyone can see.
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-md px-2 text-sm font-medium text-titan underline underline-offset-2"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* One region, always on the page. The count used to be the live region
          itself, which meant it went off the page at the moment it had
          something worth saying, and a region that arrives with its text
          already in it is the shape readers skip. */}
      <p role="status" className="sr-only">{announced}</p>

      <Panel source={spots} empty="No spots to show. Reload the page and try again.">
        {() => {
          if (visible.length === 0) {
            return (
              <div className="py-6 text-sm text-ink-faint">
                <p>{emptyLine}</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-1 min-h-11 font-medium text-titan underline underline-offset-2"
                >
                  Reset filters
                </button>
              </div>
            )
          }
          return (
            <div>
              {shownLine && <p className="mb-2 text-xs text-ink-faint">{shownLine}</p>}
              <ul className="overflow-hidden rounded-xl border border-rule bg-white">
                {visible.map((s, i) => (
                  <li
                    key={s.id}
                    className={'px-5 py-4 ' + (i > 0 ? 'border-t border-rule' : '')}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="font-semibold text-titan">{s.name}</h2>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {closedToday(s.hours, today) && (
                          <span className="rounded-md bg-tint-parking px-2 py-0.5 text-xs font-medium text-flame-ink">
                            Closed today
                          </span>
                        )}
                        <span className="rounded-md bg-titan-50 px-2 py-0.5 text-xs font-medium text-titan">
                          {spotKindLabels[s.kind] ?? s.kind}
                        </span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {s.building_name}
                      {s.floor !== null ? `, floor ${s.floor}` : ''}
                      {s.section ? ` ${s.section}` : ''}
                      <span className="text-ink-faint">
                        {' · '}{noiseText(s.noise_level)}
                        {s.has_outlets && ', outlets'}
                        {s.seats !== null ? `, about ${s.seats} seats` : ''}
                        {s.reservable && ', bookable'}
                      </span>
                    </p>
                    {s.hours_note && (
                      <p className="mt-0.5 text-xs text-ink-faint">{s.hours_note}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        }}
      </Panel>

      <p className="text-xs text-ink-faint">
        Buildings, floors, booking rules and opening hours come from CSUF, and each
        spot shows the hours CSUF publishes for the week. Everywhere stays on the
        list, including what is shut today, so that you can plan ahead; the
        recommendations on the dashboard leave out anything closed. Noise, seats
        and outlets are our own estimates.
      </p>
    </div>
  )
}
