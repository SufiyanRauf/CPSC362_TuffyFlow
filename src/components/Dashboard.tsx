import type { View } from '../types'
import { useAsync } from '../lib/useAsync'
import { findNextClass, getRecommendations } from '../lib/recommend'
import { getProfile } from '../lib/campusData'
import NextClassCard from './NextClassCard'
import RecCard from './RecCard'
import Panel from './Panel'

type DashboardProps = {
  onOpen: (view: View) => void
}

// each card opens the screen it came from
const cardView: Record<string, View> = {
  parking: 'parking',
  spot: 'spots',
  event: 'clubs',
}

export default function Dashboard({ onOpen }: DashboardProps) {
  const profile = useAsync(getProfile)
  const nextClass = useAsync(findNextClass)
  const recs = useAsync(getRecommendations)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">
          Hello {profile.state === 'ready' ? profile.data.full_name : ''}
        </h1>
        <p className="text-sm text-slate-400">Your next move on campus</p>
      </div>

      <Panel source={nextClass}>
        {(next) =>
          next ? (
            <NextClassCard
              nextClass={{
                course_code: next.course_code,
                start_time: next.start_time,
                building_id: next.building_id,
                building_name: next.building_name,
                day_of_week: next.day_of_week,
                day_offset: next.day_offset,
                minutes_until: next.minutes_until,
              }}
            />
          ) : (
            <div className="rounded-xl bg-slate-800 p-5 text-slate-300">
              No classes on your schedule yet.
            </div>
          )
        }
      </Panel>

      <Panel source={recs}>
        {(data) => (
          <div className="flex flex-wrap gap-4">
            {[data.parking[0], data.spots[0], data.events[0]]
              .filter(Boolean)
              .map((rec) => (
                <RecCard
                  key={rec.id}
                  rec={rec}
                  onOpen={() => onOpen(cardView[rec.category])}
                />
              ))}
          </div>
        )}
      </Panel>

      <div className="rounded-xl bg-slate-800 h-56 grid place-items-center text-sm text-slate-400">
        Map coming in a later sprint
      </div>
    </div>
  )
}
