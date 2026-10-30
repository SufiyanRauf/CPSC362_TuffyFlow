import { tagText } from '../lib/labels'
import { useAsync } from '../lib/useAsync'
import { getRecommendations, findNextClass } from '../lib/recommend'
import { getBuildings, getEvents, getProfile } from '../lib/campusData'
import Panel from './Panel'
import PageHeader from './PageHeader'
import Pill from './Pill'
import { ClockIcon, PinIcon, UsersIcon, WalkIcon } from './icons'
import { CAMPUS_TZ, campusDate } from '../lib/time'
import { useDataVersion } from '../lib/useDataVersion'
import { useCampusHour } from '../lib/useMinuteTick'

// The two things the walk factor can say. The card prints the minutes itself,
// so this is only here to carry what they are measured from. It used to have a
// third alternative for "no class that day to measure a walk from"; the scorer
// stopped saying that and returns an empty reason instead, so there is nothing
// left for it to match.
const WALK_REASON = /^(measured from |right by )/

// Minutes are rounded up, so an event in the building you are already in comes
// back as 0, and "0 min walk" sat directly above that factor's own "right by
// Computer Science". Same sentence as RecCard and the parking screen, because
// one number cannot read three ways.
function walkText(minutes: number) {
  return minutes === 0 ? 'Less than a minute away' : `${minutes} min walk`
}

// AM/PM, like the class and arrive-by times everywhere else. The dashboard
// shows both at once at wide widths. Up here rather than in the loop below,
// because a formatter is expensive to build and cheap to reuse, and the
// options it is built from do not depend on the event being dated.
//
// The weekday comes from its own formatter now, because it is the part that
// gives way to Today or Tomorrow. The two together print exactly what the one
// formatter used to, "Fri, Oct 30, 16:00", for any other day.
const EVENT_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TZ, month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
})

const END_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TZ, hour: 'numeric', minute: '2-digit', hour12: true,
})

const EVENT_DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TZ, weekday: 'short',
})

// The rail already does this and said why: "Tue" alone does not tell you
// whether that is today or next week. The full screen was the one still
// printing "Fri, Oct 30" for an event that starts in two hours, and on a Friday
// the top two cards read the same thing.
//
// The date stays. The window of events runs nine days, so offsets 1 and 8 land
// on the same weekday, and two cards reading "Fri" would be two different days
// with nothing on screen telling them apart.
//
// Tomorrow is counted off today's date rather than by adding 24 hours to the
// clock. Between midnight and 1am on the morning the clocks go back, 24 hours
// later is still the same date in California, and the whole screen quietly
// loses the word Tomorrow for that hour. Noon UTC is the small hours here
// either side of a change, so it never lands on the wrong day.
function dayNames() {
  const today = campusDate(new Date())
  const [y, m, d] = today.split('-').map(Number)
  return { today, tomorrow: campusDate(new Date(Date.UTC(y, m - 1, d + 1, 12))) }
}

// The scorer already ranks every event and the dashboard was showing only the
// top one, so the rest of that work was being thrown away.
async function rankedEvents() {
  const [recs, events, buildings, profile] = await Promise.all([
    getRecommendations(), getEvents(), getBuildings(), getProfile(),
  ])
  // Read off the profile rather than by picking the scorer's "matches ai and
  // music" sentence apart. That sentence is for reading, and parsing it back
  // would tie this screen's chips to the scorer's wording.
  const mine = new Set([...profile.interests, ...profile.career_goals])
  const byId = new Map(events.map((e) => [e.id, e]))
  const where = new Map(buildings.map((b) => [b.id, b.name]))
  const { today, tomorrow } = dayNames()
  // The ranking and the event list are two separate reads, so the ranking can
  // name an event this copy of the list does not have. That row has no time
  // and no host to print, which came out as a clock icon and a person icon
  // with nothing beside them, so it is dropped instead.
  return recs.events.flatMap((r) => {
    const e = byId.get(r.id)
    if (!e) return []
    const start = new Date(e.starts_at)
    const day = campusDate(start)
    const named = day === today ? 'Today' : day === tomorrow ? 'Tomorrow' : EVENT_DAY.format(start)
    return [{
      id: r.id,
      title: r.title,
      match: r.match_percent,
      host: e.club_name,
      tags: e.tags,
      where: where.get(e.building_id) ?? '',
      // Both ends. "4:00 PM" alone does not say whether this is a talk you
      // can fit in a gap or something that runs all afternoon, and ends_at was
      // already being fetched and thrown away.
      when: `${named}, ${EVENT_TIME.format(start)}\u2013${END_TIME.format(new Date(e.ends_at))}`,
      mine: e.tags.filter((t) => mine.has(t)),
      walk: r.walk_minutes,
      measuredFrom: r.reasons.find((x) => WALK_REASON.test(x)) ?? '',
    }]
  })
}

export default function EventsView() {
  const version = useDataVersion()
  // The ranking drops anything that has already started and the dates are
  // built from the day they are read, and nothing bumps the data version on
  // the clock, so on [version] alone a tab left open kept listing events that
  // were over and still said tomorrow the morning after.
  const hour = useCampusHour()
  const events = useAsync(rankedEvents, [version, hour])
  const next = useAsync(findNextClass, [version, hour])

  // The ranking is empty with no class at all, not only when the filter took
  // everything out, so an account with nothing on its schedule was being told
  // its events had been fitted around classes it has not entered yet.
  const haveClass = next.state === 'ready' && next.data !== null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Events">
        Events are ordered by how well they match your interests, how close they are to your
        classes that day, and how soon they start. Anything that overlaps one of your classes
        is left out. The match percent is scored out of what we can judge for you, so nothing
        reaches a hundred.
      </PageHeader>

      <Panel
        source={events}
        empty={
          haveClass
            ? 'Nothing upcoming that fits around your classes.'
            : 'Nothing to show yet. Add a class on your profile and these fill in.'
        }
      >
        {(rows) => (
          <ul className="flex flex-col gap-3">
            {rows.map((e, i) => (
              <li
                key={e.id}
                className={
                  'rounded-xl border px-5 py-4 ' +
                  (i === 0 ? 'border-titan-200 bg-titan-50' : 'border-rule bg-white')
                }
              >
                {/* The match pill used to be a row of its own opposite this
                    block. On a phone there was no room for it beside the
                    event, so it wrapped down underneath the host and the
                    measured from line, which left the number the whole
                    ranking is built on at the bottom of the card. The parking
                    rows keep their pill beside the title, where it stays at
                    any width, so this does the same. */}
                <div className="flex flex-wrap items-center gap-2">
                  {i === 0 && <Pill tone="mark">Best match</Pill>}
                  <Pill tone="match">{e.match}% match</Pill>
                </div>

                <h2 className={(i === 0 ? 'text-2xl ' : 'text-lg ') + 'mt-2 font-semibold text-titan'}>
                  {e.title}
                </h2>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
                  {/* items-start, because when the range wraps to two lines
                      items-center puts the icon in the gutter between them.
                      Same shape RecCard uses for its own wrapping rows. */}
                  <span className="inline-flex items-start gap-1.5">
                    <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                    {e.when}
                  </span>
                  {e.where && (
                    <span className="inline-flex items-center gap-1.5">
                      <PinIcon className="h-4 w-4 text-ink-faint" />
                      {e.where}
                    </span>
                  )}
                  {e.walk !== null && (
                    <span className="inline-flex items-center gap-1.5">
                      <WalkIcon className="h-4 w-4 text-ink-faint" />
                      {walkText(e.walk)}
                    </span>
                  )}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-faint">
                  <UsersIcon className="h-4 w-4" />
                  {e.host}
                </p>
                {/* what the walk is measured from, or that nothing on that
                    day says where you would be starting from */}
                {e.measuredFrom && (
                  <p className="mt-1 text-sm text-ink-faint">{e.measuredFrom}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.tags.map((t) => (
                    <span
                      key={t}
                      className={
                        'rounded-md px-2 py-0.5 text-xs ' +
                        (e.mine.includes(t)
                          // same as the club cards: the tags that are yours are
                          // the reason this event is on the screen at all
                          ? 'bg-flame/15 font-semibold text-flame-ink'
                          : 'text-ink-soft ' + (i === 0 ? 'bg-white' : 'bg-titan-50'))
                      }
                    >
                      {tagText(t)}
                      {/* The tint and the heavier weight are both only visible,
                          and the card used to carry a "matches ai and music"
                          sentence that said this in words. Dropping it left a
                          reader with a flat list of tag names and nothing
                          saying which ones put the event here. */}
                      {e.mine.includes(t) && <span className="sr-only">, one of yours</span>}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* This used to lead with "we made up", which reads as a warning about
          the whole screen and invites a student to throw out the ranking too.
          The ranking is real code over the real club list and the student's
          real schedule. So the real part goes first, and the invented part is
          scoped to what is actually invented, in the same hedged voice the
          parking and clubs footnotes use. */}
      <p className="text-xs text-ink-faint">
        The clubs hosting these are real, and the order runs on your own classes and interests.
        The event titles and times are our own.
      </p>
    </div>
  )
}
