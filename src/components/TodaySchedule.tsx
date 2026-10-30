import { useMemo } from 'react'
import { useAsync } from '../lib/useAsync'
import { getBuildings, getClassMeetings } from '../lib/campusData'
import { campusNow } from '../lib/recommend'
import { clockRange, toMinutes } from '../lib/time'
import { useMinuteTick } from '../lib/useMinuteTick'
import { useDataVersion } from '../lib/useDataVersion'
import Panel from './Panel'
import Pill from './Pill'

type Status = 'now' | 'upcoming' | 'done'

const statusLabels: Record<Status, string> = {
  now: 'In class',
  upcoming: 'Upcoming',
  done: 'Done',
}

// Fetching and working out are separate on purpose. The rows change when the
// schedule does; the statuses change when the clock does. Doing both in one
// loader meant asking the database for the same 37 documents every minute to
// find out whether a class had started.
async function todaysRows() {
  const [meetings, buildings] = await Promise.all([getClassMeetings(), getBuildings()])
  return { meetings, buildings }
}

function shape({ meetings, buildings }: Awaited<ReturnType<typeof todaysRows>>) {
  const { dayOfWeek, minutes } = campusNow()
  const where = new Map(buildings.map((b) => [b.id, b.name]))
  return meetings
    .filter((m) => m.day_of_week === dayOfWeek)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((m) => {
      const from = toMinutes(m.start_time)
      const to = toMinutes(m.end_time)
      // read off the clock rather than hard coded, so the table is never telling
      // someone they are still in a class that finished two hours ago
      const status: Status = minutes >= to ? 'done' : minutes >= from ? 'now' : 'upcoming'
      return {
        id: m.id,
        course: m.course_code,
        // One span, and clockRange says the AM or PM once when both ends share
        // it. Printing it twice pushed this column wide enough that the status
        // pill sat further off the side of a phone than the table was sized
        // for. It only narrows the column on days where nothing crosses noon:
        // a class running 11:30 to 12:45 has to keep both markers, and the
        // widest row is what sizes the column.
        when: clockRange(m.start_time, m.end_time),
        where: where.get(m.building_id) ?? 'Campus',
        status,
      }
    })
}

export default function TodaySchedule() {
  const source = useAsync(todaysRows, [useDataVersion()])
  // in the dependencies on purpose, and not used in the body: it is the clock
  // moving that makes the statuses worth working out again
  const tick = useMinuteTick()
  const classes = useMemo(
    () => (source.state === 'ready'
      ? { state: 'ready' as const, data: shape(source.data) }
      : source),
    [source, tick],
  )

  return (
    <Panel source={classes} empty="Nothing scheduled today.">
      {(rows) => (
        // the status column fell off the right edge of a phone and overflow-hidden
        // meant there was no way to reach it
        <div className="overflow-x-auto rounded-xl border border-rule">
          <table className="w-full min-w-[26rem] border-collapse text-sm">
            <caption className="sr-only">Your classes today, in order</caption>
            <thead>
              <tr className="bg-paper text-left text-[0.7rem] uppercase tracking-[0.1em] text-ink-faint">
                <th scope="col" className="px-4 py-2.5 font-semibold">Time</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Course</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Building</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={c.id} className={i % 2 === 1 ? 'bg-paper/50' : 'bg-white'}>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-soft">
                    {c.when}
                  </td>
                  <th scope="row" className="px-4 py-3 text-left font-semibold text-titan">
                    {c.course}
                  </th>
                  <td className="px-4 py-3 text-ink-soft">{c.where}</td>
                  <td className="px-4 py-3 text-right">
                    <Pill tone={c.status}>{statusLabels[c.status]}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
