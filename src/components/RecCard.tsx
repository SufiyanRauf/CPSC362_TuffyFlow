import type { Recommendation, RecCategory } from '../types'

type RecCardProps = {
  rec: Recommendation
}

const labels: Record<RecCategory, string> = {
  parking: 'Best parking',
  spot: 'Study spot',
  event: 'Event',
}

export default function RecCard({ rec }: RecCardProps) {
  // clamp so a bad value cannot overflow the bar
  const width = Math.max(0, Math.min(100, rec.match_percent))

  return (
    <div className="flex-1 min-w-56 rounded-xl bg-slate-800 p-4">
      <span className="inline-block rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
        {labels[rec.category] ?? 'Suggestion'}
      </span>

      <h3 className="mt-3 font-semibold">{rec.title}</h3>
      <p className="mt-1 text-sm text-slate-400">{rec.reason}</p>

      <div className="mt-4 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
          <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${width}%` }} />
        </div>
        <span className="text-xs text-slate-400">{rec.match_percent}%</span>
      </div>
    </div>
  )
}
