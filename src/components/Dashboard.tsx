import type { NextClass, RecCategory, View } from '../types'
import { useAsync } from '../lib/useAsync'
import { campusNow, findNextClass, getRecommendations } from '../lib/recommend'
import { getProfile } from '../lib/campusData'
import NextClassCard from './NextClassCard'
import RecCard from './RecCard'
import Panel from './Panel'
import SectionHeader from './SectionHeader'
import TodaySchedule from './TodaySchedule'
import { ClockIcon, PinIcon } from './icons'
import { useDataVersion } from '../lib/useDataVersion'
import { useMinuteTick } from '../lib/useMinuteTick'

type DashboardProps = {
  onOpen: (view: View) => void
}

// each card opens the screen it came from
const cardView: Record<RecCategory, View> = {
  parking: 'parking',
  spot: 'spots',
  event: 'events',
}

// minutes_until is whatever the gap was when findNextClass ran, so a card
// drawn at 08:20 still read "Starts in 40 min" at 11:00. The gap is worked out
// again here against the campus clock, off the class start, which does not go
// stale. The fetch keys on the minute now, so this is mostly belt and braces,
// but it is still what makes the countdown right in the moment before a
// re-fetch has resolved. Floored at zero because a class can start between two
// fetches and counting past the start would print a negative minute count.
function untilStart(next: NextClass): NextClass {
  const gap = next.day_offset * 1440 + next.start_minutes - campusNow().minutes
  return { ...next, minutes_until: Math.max(0, gap) }
}

export default function Dashboard({ onOpen }: DashboardProps) {
  const version = useDataVersion()
  // The class and the ranking are both worked out against the clock, and the
  // data version only moves on a write or a sign in, so a tab left open
  // counted down to a class that had already started.
  //
  // One clock, on the minute, for both loaders. It used to be two: the ranking
  // keyed on the hour because it looked like the expensive one. Both of them
  // were wrong for up to fifty-nine minutes at a stretch because of it. A
  // 09:30 class left the hero reading "Starts in 0 min" until 10:00 while the
  // table further down the same screen correctly said In class, and worse, the
  // lot block kept the previous class's answer, so "Be at lot by 11:07 AM" sat
  // under "Next class MATH 338, 2:00 PM".
  //
  // Per minute is free for both. findNextClass only awaits getClassMeetings
  // and getBuildings, which hand back promises they are already holding, and
  // getRecommendations is keyed on which class is next, so it returns the
  // promise it already has until the class actually changes.
  const minute = useMinuteTick()
  const profile = useAsync(getProfile, [version])
  const nextClass = useAsync(findNextClass, [version, minute])
  // On the minute, not the hour, same as the class above it. The ranking is
  // keyed on which class is next, but a key only helps when something asks,
  // and asking hourly meant the hero kept the previous class's lot for the
  // rest of the hour: "Be at lot by 11:07 AM" under "Next class MATH 338,
  // 2:00 PM". Asking every minute is free, because getRecommendations hands
  // back the promise it is already holding whenever the key has not moved,
  // and the key only moves when the class does.
  const recs = useAsync(getRecommendations, [version, minute])

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
  // findNextClass looks forward through the whole week, so a null means there
  // is no class anywhere on the schedule, not just none left today. That one
  // fact used to get stated three times down this screen: the hero said "No
  // classes on your schedule yet", the ranking said "Nothing to rank yet. Add
  // your classes", and the table at the bottom said "Nothing scheduled today".
  // Three empty shelves and three different wordings for one thing somebody
  // has not done yet. So when the schedule is genuinely empty the screen says
  // it once, with the one button, and the two sections that can only repeat it
  // stay off. Classes on Tuesday and Thursday looked at on a Wednesday is NOT
  // this case, and all three sections still have something worth saying.
  const noClasses = nextClass.state === 'ready' && nextClass.data === null

  return (
    <div className="flex flex-col gap-8">
      <div>
        {/* Not "Welcome back". An account on its first visit has never been
            here, and the very first line of the app was telling it otherwise.
            Plain "Welcome" is true the first time and still true the
            hundredth, which is the only thing one greeting has to do when it
            has no way of knowing which visit this is. */}
        <h1 className="text-2xl font-semibold tracking-tight text-titan">
          Welcome{firstName && `, ${firstName}`}
        </h1>
        {/* max-w-2xl because PageHeader caps every other screen's subtitle at
            the same width. This one cannot use PageHeader: the title is a
            greeting with a name in it, not a plain string. */}
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Where to park, where to work, and what's happening between your classes.
        </p>
      </div>

      <Panel source={hero}>
        {(next) =>
          next ? (
            <NextClassCard
              nextClass={untilStart(next)}
              lot={topLot}
              onOpenProfile={() => onOpen('profile')}
              rankingReady={recs.state === 'ready'}
            />
          ) : (
            <div className="rounded-xl border border-rule bg-paper px-6 py-6">
              <h2 className="text-lg font-semibold text-titan">Add your classes to get started</h2>
              <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
                Tuffy Flow works off your weekly schedule. Once it knows where you have
                to be, it can tell you where to park, how early to leave, and where to
                work near your next class.
              </p>
              <button
                type="button"
                onClick={() => onOpen('profile')}
                className="mt-4 min-h-11 rounded-lg bg-titan px-4 text-sm font-medium text-white hover:bg-titan-700"
              >
                Add your classes
              </button>
            </div>
          )
        }
      </Panel>

      {/* Both of these can only restate the card above when the schedule is
          empty: a ranking with nothing to show, and a table of nothing. So
          they stay off until there is a schedule to talk about. */}
      {!noClasses && (
        <>
        <section>
          {/* No "right now" in the note any more. These are ranked for the
              next class, and on a Friday evening the next class is Monday,
              which the hero says out loud forty pixels above this. The nouns
              went too: the middle card is whatever scored highest out of the
              spots and the scorer does not filter on kind, so it can be headed
              Food or Meet up under a note that promised a study spot. What is
              true either way is what the ranking is reading, so that is what
              it says. */}
          <SectionHeader
            icon={<PinIcon className="h-4 w-4" />}
            title="Where to go next"
            note="Picked for your next class and your interests."
          />
          <Panel source={recs}>
            {(data) => data.spots.length + data.events.length === 0 ? (
              // Parking is out of this sum on purpose. The lot answer lives on
              // the hero now, so counting it here would call the whole row
              // empty every time the permit was missing, which is the most
              // common thing a new account has going on.
              //
              // An empty schedule cannot reach this either, because the whole
              // section is behind noClasses. What is left is the account with
              // classes on file that still scored no spot and no event: a
              // Sunday evening with everywhere shut and nothing coming up.
              // Telling somebody to add the classes they already have was the
              // wrong answer, so the permit gets named instead, hedged because
              // it is the usual reason rather than the only one. The button is
              // the same one the hero offers when there is no lot to show, so
              // the two dead ends do not hand out two different amounts of
              // help for one cause.
              <div className="rounded-xl border border-rule bg-paper px-5 py-6 text-sm text-ink-soft">
                <p>
                  Nothing to show for today. If your profile does not say which permit you
                  hold, that is usually why.
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
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Parking used to have a slot here and it was printing the
                    hero's lot a second time: same name, same walk, same
                    arrive-by time, and a sentence about how full it usually is
                    that was byte for byte the one in the hero. The hero keeps
                    that answer, because it is the copy with the Directions
                    link, with the arrive-by time at a size a driver can
                    actually read, and with the day on it. This card
                    only ever showed a bare clock time with nothing saying
                    which day it was for, so on a Friday evening it read as
                    this morning. The Parking item in the sidebar is still one
                    press away on every screen width, so nothing has been shut
                    off here. */}
                {[
                  { slot: 'spots', rec: data.spots[0] },
                  { slot: 'events', rec: data.events[0] },
                ].map(({ slot, rec }) =>
                  rec ? (
                    <RecCard
                      key={slot}
                      rec={rec}
                      onOpen={() => onOpen(cardView[rec.category])}
                    />
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
        </>
      )}
    </div>
  )
}
