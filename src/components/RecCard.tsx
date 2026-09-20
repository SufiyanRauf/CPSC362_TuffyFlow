import type { Recommendation } from '../types'

type RecCardProps = {
  rec: Recommendation
}

// One card used for all three recommendation types. The label changes, the layout
// does not, which is the same idea as the scoring engine handling all three.
const labels = {
  parking: 'Best parking',
  spot: 'Study spot',
  event: 'Event',
}

export default function RecCard({ rec }: RecCardProps) {
  return (
    <div className="flex-1 min-w-56 rounded-xl bg-slate-800 p-4">
      <span className="inline-block rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
        {labels[rec.kind]}
      </span>

      <h3 className="mt-3 font-semibold">{rec.title}</h3>
      <p className="mt-1 text-sm text-slate-400">{rec.reason}</p>

      <div className="mt-4 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-slate-700">
          <div
            className="h-1.5 rounded-full bg-amber-500"
            style={{ width: `${rec.matchPercent}%` }}
          />
        </div>
        <span className="text-xs text-slate-400">{rec.matchPercent}%</span>
      </div>
    </div>
  )
}
