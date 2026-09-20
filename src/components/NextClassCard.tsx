import type { NextClass } from '../types'

type NextClassCardProps = {
  nextClass: NextClass
}

export default function NextClassCard({ nextClass }: NextClassCardProps) {
  // evenings, weekends, or no schedule added yet
  if (nextClass.minutes_until === null) {
    return (
      <div className="rounded-xl bg-slate-800 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-400">Next class</p>
        <p className="mt-2 text-slate-300">No more classes today.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-slate-800 p-5 flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Next class</p>
        <h2 className="mt-1 text-2xl font-semibold">{nextClass.course_code}</h2>
        <p className="text-sm text-slate-400">
          {nextClass.start_time} · {nextClass.building_name}
        </p>
      </div>

      <div className="text-right">
        <p className="text-xs text-slate-400">Starts in</p>
        <p className="text-3xl font-semibold text-amber-400">{nextClass.minutes_until} min</p>
      </div>
    </div>
  )
}
