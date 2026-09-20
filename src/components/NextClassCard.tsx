import type { NextClass } from '../types'

type NextClassCardProps = {
  nextClass: NextClass
}

export default function NextClassCard({ nextClass }: NextClassCardProps) {
  // A student with no classes left today still has to see something sensible.
  // Once the real schedule is wired up this also covers evenings and weekends.
  if (nextClass.minutesUntil === null) {
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
        <h2 className="mt-1 text-2xl font-semibold">{nextClass.courseCode}</h2>
        <p className="text-sm text-slate-400">
          {nextClass.startsAt} · {nextClass.building}
        </p>
      </div>

      <div className="text-right">
        <p className="text-xs text-slate-400">Starts in</p>
        <p className="text-3xl font-semibold text-amber-400">{nextClass.minutesUntil} min</p>
      </div>
    </div>
  )
}
