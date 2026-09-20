import { student, nextClass, recommendations } from '../data'
import NextClassCard from './NextClassCard'
import RecCard from './RecCard'

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Hello {student.name}</h1>
        <p className="text-sm text-slate-400">Your next move on campus</p>
      </div>

      <NextClassCard nextClass={nextClass} />

      <div className="flex flex-wrap gap-4">
        {recommendations.map((rec) => (
          <RecCard key={rec.id} rec={rec} />
        ))}
      </div>

      {/* The map goes here once Leaflet is set up. Keeping the space so the
          layout does not shift when it arrives. */}
      <div className="rounded-xl bg-slate-800 h-56 grid place-items-center text-sm text-slate-500">
        Map coming in a later sprint
      </div>
    </div>
  )
}
