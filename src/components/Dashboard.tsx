import type { RecCategory, View } from '../types'
import { useAsync } from '../lib/useAsync'
import { findNextClass, getRecommendations } from '../lib/recommend'
import { getProfile } from '../lib/campusData'
import NextClassCard from './NextClassCard'
import RecCard from './RecCard'
import Panel from './Panel'
import SectionHeader from './SectionHeader'
import TodaySchedule from './TodaySchedule'
import { ClockIcon, PinIcon } from './icons'
import { useDataVersion } from '../lib/useDataVersion'

type DashboardProps = {
  onOpen: (view: View) => void
}

// each card opens the screen it came from
const cardView: Record<RecCategory, View> = {
  parking: 'parking',
  spot: 'spots',
  event: 'events',
}

export default function Dashboard({ onOpen }: DashboardProps) {
  const version = useDataVersion()
  const profile = useAsync(getProfile, [version])
  const nextClass = useAsync(findNextClass, [version])
  const recs = useAsync(getRecommendations, [version])

  const firstName = profile.state === 'ready' ? profile.data.full_name.trim().split(' ')[0] : ''
  // the hero wants the top lot too, and it loads separately from the class
  const topLot = recs.state === 'ready' ? recs.data.parking[0] ?? null : null

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-titan">
          Welcome back{firstName && `, ${firstName}`}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Where to park, where to work, and what is on between your classes today.
        </p>
      </div>

      <Panel source={nextClass}>
        {(next) =>
          next ? (
            <NextClassCard nextClass={next} lot={topLot} />
          ) : (
            <div className="rounded-xl border border-rule bg-paper px-6 py-6 text-ink-soft">
              No classes on your schedule yet.
            </div>
          )
        }
      </Panel>

      <section>
        <SectionHeader
          icon={<PinIcon className="h-4 w-4" />}
          title="Where to go next"
          note="Top pick in each category, scored against your schedule and interests."
        />
        <Panel source={recs}>
          {/* one column or three, never two and an orphan */}
          {(data) => data.parking.length + data.spots.length + data.events.length === 0 ? (
            <div className="rounded-xl border border-rule bg-paper px-5 py-6 text-sm text-ink-soft">
              <p>Nothing to rank yet. Add your classes and this fills in.</p>
              <button
                type="button"
                onClick={() => onOpen('profile')}
                className="mt-3 min-h-11 rounded-lg bg-titan px-4 text-sm font-medium text-white hover:bg-titan-700"
              >
                Add your classes
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
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
      </section>

      <section>
        <SectionHeader
          icon={<ClockIcon className="h-4 w-4" />}
          title="Today's schedule"
          action={{ label: 'Full week', onClick: () => onOpen('profile') }}
        />
        <TodaySchedule />
      </section>
    </div>
  )
}
