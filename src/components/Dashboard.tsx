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

  // No name on a brand new account, and no greeting is better than greeting
  // somebody by the front half of their email address.
  const firstName = profile.state === 'ready'
    ? profile.data.full_name?.trim().split(' ')[0] ?? ''
    : ''
  // the hero wants the top lot too, and it loads separately from the class
  const topLot = recs.state === 'ready' ? recs.data.parking[0] ?? null : null
  // The hero is two halves: the class out of nextClass, which is two reads,
  // and the park here block out of recs, which is seven reads and a POST to
  // the scorer. Rendering on nextClass alone painted the short card and then
  // grew the second half under the cursor, which drops everything below it,
  // including the button, mid tap. So the card waits for the scorer as well.
  // Settled rather than ready: a scorer that failed has still finished, and
  // the card is worth showing with no lot on it.
  const hero = recs.state === 'loading' ? { state: 'loading' as const } : nextClass

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

      <Panel source={hero}>
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
          {(data) => data.parking.length + data.spots.length + data.events.length === 0 ? (
            // All three empty is what an account with no classes looks like,
            // and also what a Sunday evening looks like on an account that has
            // classes but no permit on file, with every spot shut and nothing
            // coming up. Telling the second one to go and add the classes it
            // already has is the wrong answer, so the schedule decides which
            // sentence runs: only a loaded, genuinely empty one gets the
            // button, and the permit gets named otherwise because it is the
            // usual reason a day scores nothing.
            nextClass.state === 'ready' && nextClass.data === null ? (
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
              <div className="rounded-xl border border-rule bg-paper px-5 py-6 text-sm text-ink-soft">
                <p>
                  Nothing scored for today. If your profile does not say which permit you
                  hold, that is usually why.
                </p>
              </div>
            )
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {/* One slot per category, in the order the sidebar and the
                  footnotes read: parking, spots, events. The slots carry the
                  order so the parking placeholder can sit in the slot it
                  belongs to. Appending it after the scored cards put it third,
                  which is backwards, and it was the common case rather than
                  the rare one. */}
              {[
                { slot: 'parking', rec: data.parking[0] },
                { slot: 'spots', rec: data.spots[0] },
                { slot: 'events', rec: data.events[0] },
              ].map(({ slot, rec }) =>
                rec ? (
                  <RecCard
                    key={slot}
                    rec={rec}
                    onOpen={() => onOpen(cardView[rec.category])}
                  />
                ) : slot === 'parking' ? (
                  // A card for the gap, rather than a gap. An account with
                  // classes but no permit on file has nothing to put in the
                  // parking slot, which left two cards and an empty third and
                  // nothing on the screen saying why. It is also the most
                  // common thing a new account sees, not an edge case. An
                  // empty spots or events slot has no sentence like this one
                  // to offer, so it still closes up.
                  <div
                    key={slot}
                    className="rounded-xl border border-dashed border-rule-strong bg-paper px-5 py-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-faint">
                      Parking
                    </p>
                    <p className="mt-2 text-sm text-ink-soft">
                      Nothing here until your profile says which permit you hold.
                      Lots take some permits and not others.
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpen('profile')}
                      className="mt-3 min-h-11 rounded-lg border border-titan px-4 text-sm font-medium
                                 text-titan hover:bg-titan hover:text-white"
                    >
                      Set your permit
                    </button>
                  </div>
                ) : null,
              )}
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
