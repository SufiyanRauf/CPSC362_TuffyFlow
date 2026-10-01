import type { NextClass } from '../types'

type NextClassCardProps = {
  nextClass: NextClass
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Raw minutes read fine for a class this morning and badly for one on Monday,
// where it comes out as "2100 min".
function countdown(minutes: number, dayOffset: number, dayOfWeek: number) {
  if (dayOffset === 0) {
    if (minutes < 60) return { value: `${minutes} min`, label: 'Starts in' }
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return { value: rest ? `${hours} hr ${rest} min` : `${hours} hr`, label: 'Starts in' }
  }
  if (dayOffset === 1) return { value: 'Tomorrow', label: 'Next up' }
  return { value: DAYS[dayOfWeek] ?? 'Later', label: 'Next up' }
}

export default function NextClassCard({ nextClass }: NextClassCardProps) {
  if (nextClass.minutes_until === null) {
    return (
      <div className="rounded-xl bg-slate-800 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-400">Next class</p>
        <p className="mt-2 text-slate-300">No more classes today.</p>
      </div>
    )
  }

  const { value, label } = countdown(
    nextClass.minutes_until, nextClass.day_offset, nextClass.day_of_week,
  )

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
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-2xl font-semibold text-amber-400">{value}</p>
      </div>
    </div>
  )
}
