import type { Recommendation, RecCategory } from '../types'
import { spotKindLabels } from '../lib/labels'

type RecCardProps = {
  rec: Recommendation
  onOpen?: () => void
}

const labels: Record<RecCategory, string> = {
  parking: 'Best parking',
  spot: 'Study spot',
  event: 'Event',
}

function labelFor(rec: Recommendation) {
  if (rec.category === 'spot' && rec.kind) {
    return spotKindLabels[rec.kind] ?? 'Study spot'
  }
  return labels[rec.category] ?? 'Suggestion'
}

export default function RecCard({ rec, onOpen }: RecCardProps) {
  const width = Math.max(0, Math.min(100, rec.match_percent))

  const body = (
    <>
      <span className="inline-block rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
        {labelFor(rec)}
      </span>

      <p className="mt-3 font-semibold">{rec.title}</p>
      <p className="mt-1 text-sm text-slate-400">{rec.reason}</p>
      {rec.category === 'parking' && (
        <p className="mt-1 text-sm text-amber-400">
          {rec.arrive_by ? `arrive by ${rec.arrive_by}` : 'leave now'}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
          <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${width}%` }} />
        </div>
        <span className="text-xs text-slate-400">{rec.match_percent}%</span>
      </div>
    </>
  )

  if (!onOpen) {
    return <div className="basis-full sm:basis-0 sm:flex-1 sm:min-w-56 rounded-xl bg-slate-800 p-4">{body}</div>
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="basis-full sm:basis-0 sm:flex-1 sm:min-w-56 rounded-xl bg-slate-800 p-4 text-left hover:bg-slate-700"
    >
      {body}
    </button>
  )
}
