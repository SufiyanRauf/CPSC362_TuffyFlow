import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { getSpots } from '../lib/campusData'
import Panel from './Panel'
import PageHeader from './PageHeader'
import { spotKindLabels } from '../lib/labels'

const KINDS = ['any', 'study', 'eat', 'charge', 'meet'] as const

export default function SpotsView() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>('any')
  const [maxNoise, setMaxNoise] = useState(5)
  const [outletsOnly, setOutletsOnly] = useState(false)
  const spots = useAsync(getSpots)

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
          <input
            className="h-6"
            type="range" min={1} max={5} value={maxNoise}
            onChange={(e) => setMaxNoise(Number(e.target.value))}
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
            return <p className="text-sm text-ink-faint">No spots match these filters.</p>
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
                      <span className="shrink-0 rounded-md bg-titan-50 px-2 py-0.5 text-xs font-medium text-titan">
                        {spotKindLabels[s.kind] ?? s.kind}
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
        Buildings, floors, booking rules and opening hours come from CSUF. Hours shown are
        Monday to Thursday; each spot lists the rest of its week. Noise, seats and outlets are
        our own estimates.
      </p>
    </div>
  )
}
