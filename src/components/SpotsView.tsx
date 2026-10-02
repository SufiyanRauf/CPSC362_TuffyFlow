import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { getSpots } from '../lib/campusData'
import Panel from './Panel'
import { spotKindLabels } from '../lib/labels'

const KINDS = ['any', 'study', 'eat', 'charge', 'meet'] as const

export default function SpotsView() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>('any')
  const [maxNoise, setMaxNoise] = useState(5)
  const [outletsOnly, setOutletsOnly] = useState(false)
  const spots = useAsync(getSpots)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Spots</h1>
        <p className="text-sm text-slate-400">
          Buildings, floors, booking rules and all opening hours are from CSUF. Hours shown are the
          Monday to Thursday ones; see each spot for the rest of the week. Noise ratings, seat
          counts and outlet availability are our own estimates.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-800 p-3 text-sm">
        <select
          aria-label="Filter by kind of spot"
          value={kind}
          onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}
          className="rounded-md bg-slate-700 px-2 py-1"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>{k === 'any' ? 'All kinds' : spotKindLabels[k]}</option>
          ))}
        </select>

        <label className="flex items-center gap-2">
          quiet to
          <input
            type="range" min={1} max={5} value={maxNoise}
            onChange={(e) => setMaxNoise(Number(e.target.value))}
          />
          <span className="w-4 text-slate-400">{maxNoise}</span>
        </label>

        <label className="flex items-center gap-2">
          <input
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
            return <p className="text-sm text-slate-400">No spots match these filters.</p>
          }
          return (
            <>
              <p className="text-xs text-slate-400">{visible.length} of {all.length} spots</p>
              <div className="flex flex-col gap-2">
                {visible.map((s) => (
                  <div key={s.id} className="rounded-xl bg-slate-800 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{s.name}</h2>
                        <p className="text-sm text-slate-400">
                          {s.building_name}
                          {s.floor ? `, floor ${s.floor}` : ''}
                          {s.section ? ` ${s.section}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        {spotKindLabels[s.kind]}
                      </span>
                    </div>
                    {s.hours_note && (
                      <p className="mt-2 text-xs text-slate-400">{s.hours_note}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>noise {s.noise_level} of 5</span>
                      {s.has_outlets && <span>outlets</span>}
                      {s.seats && <span>about {s.seats} seats</span>}
                      {s.reservable && <span>bookable</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        }}
      </Panel>
    </div>
  )
}
