import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { useDataVersion } from '../lib/useDataVersion'
import { getSpots } from '../lib/campusData'
import type { Spot } from '../types'
import Panel from './Panel'
import PageHeader from './PageHeader'
import { spotKindLabels } from '../lib/labels'
import { campusNow } from '../lib/recommend'

const KINDS = ['any', 'study', 'eat', 'charge', 'meet'] as const

// Shut today, which is most of the food on a weekend. This screen is for
// browsing rather than for being told where to go now, so a place that is
// closed stays on the list and says so. Hiding it would be worse: you cannot
// plan a Monday on a Sunday if Monday's options are invisible.
function closedToday(hours: Spot['hours'], day: number) {
  return Object.keys(hours).length > 0 && !hours[day]
}

export default function SpotsView() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>('any')
  const [maxNoise, setMaxNoise] = useState(5)
  const [outletsOnly, setOutletsOnly] = useState(false)
  // every other loader in the app takes the version. Without it this keeps
  // whichever account's fetch it started with, and a first fetch that failed
  // is never tried again.
  const spots = useAsync(getSpots, [useDataVersion()])
  const today = campusNow().dayOfWeek

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Study spots">
        Somewhere to work, eat or meet between classes.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-rule
                      bg-paper px-4 py-3 text-sm">
        <select
          aria-label="Filter by kind of spot"
          value={kind}
          onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}
          className="rounded-md border border-rule bg-white px-2.5 py-1.5"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>{k === 'any' ? 'All kinds' : spotKindLabels[k]}</option>
          ))}
        </select>

        <label className="flex min-h-11 items-center gap-2">
          quiet to
          {/* the label around this reads out as "quiet to 3", which says
              neither what the 3 is nor what it is out of, so the slider names
              itself the same way the one on the profile screen does */}
          <input
            className="h-6"
            type="range" min={1} max={5} value={maxNoise}
            onChange={(e) => setMaxNoise(Number(e.target.value))}
            aria-label="Loudest noise level to show, 1 is quietest"
            aria-valuetext={`${maxNoise} of 5`}
          />
          <span className="w-4 tabular-nums text-ink-soft">{maxNoise}</span>
        </label>

        <label className="flex min-h-11 items-center gap-2">
          <input
            className="h-5 w-5"
            type="checkbox" checked={outletsOnly}
            onChange={(e) => setOutletsOnly(e.target.checked)}
          />
          outlets only
        </label>
      </div>

      <Panel source={spots} empty="No spots loaded.">
        {(all) => {
          const visible = all.filter(
            (s) =>
              (kind === 'any' || s.kind === kind) &&
              s.noise_level <= maxNoise &&
              (!outletsOnly || s.has_outlets),
          )
          if (visible.length === 0) {
            return (
              // role="status" like the count line it replaces, so filtering
              // down to nothing is still announced
              <p role="status" className="text-sm text-ink-faint">No spots match these filters.</p>
            )
          }
          return (
            <div>
              <p role="status" className="mb-2 text-xs text-ink-faint">
                Showing {visible.length} of {all.length}
              </p>
              <ul className="overflow-hidden rounded-xl border border-rule bg-white">
                {visible.map((s, i) => (
                  <li
                    key={s.id}
                    className={'px-5 py-3.5 ' + (i > 0 ? 'border-t border-rule' : '')}
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
                        {' · '}noise {s.noise_level} of 5
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
        spot shows its published week. Everywhere stays on the list, including
        what is shut today, so that you can plan ahead; the recommendations on
        the dashboard leave out anything closed. Noise, seats and outlets are
        our own estimates.
      </p>
    </div>
  )
}
