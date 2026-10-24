import { useAsync } from '../lib/useAsync'
import { getAvailabilityAround, getParkingLots } from '../lib/campusData'
import { campusNow } from '../lib/recommend'
import { BUSY_PERCENT } from '../lib/time'
import { useCampusHour } from '../lib/useMinuteTick'
import { useDataVersion } from '../lib/useDataVersion'
import Panel from './Panel'

// What CSUF actually counts. The employee, resident and hourly lots are our
// estimates, so they are deliberately not in this strip. S8 and S10 are counted
// as one row on the board, which is why they sit together here too.
const COUNTED = [
  'Nutwood Parking Structure',
  'State College Parking Structure',
  'Eastside North Parking Structure',
  'Eastside South Parking Structure',
  'S8',
  'S10',
]

async function fillNow() {
  const { dayOfWeek, minutes } = campusNow()
  const hour = Math.min(21, Math.max(6, Math.floor(minutes / 60)))
  const [lots, rows] = await Promise.all([
    getParkingLots(), getAvailabilityAround(dayOfWeek, hour),
  ])
  const atHour = new Map(rows.filter((r) => r.hour === hour).map((r) => [r.lot_id, r.typical_pct_full]))
  return {
    hour,
    lots: COUNTED.map((name) => {
      const lot = lots.find((l) => l.name === name)
      return { name, pct: lot ? atHour.get(lot.id) ?? 0 : 0 }
    }),
  }
}

export default function StructureFill() {
  // The hour, not the minute. Which occupancy row this shows only changes on
  // the hour, so asking again every minute was sixty times the reads for the
  // same answer.
  const data = useAsync(fillNow, [useCampusHour(), useDataVersion()])

  return (
    <Panel source={data}>
      {({ hour, lots }) => (
        <>
          <p className="text-xs text-ink-faint">
            What these usually look like around {String(hour).padStart(2, '0')}:00.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {lots.map((l) => (
              <li key={l.name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">{l.name}</span>
                  <span className="shrink-0 tabular-nums text-ink-soft">
                    {l.pct}%
                    {/* the bar turning orange is the only cue otherwise, and a
                        color on its own is not a cue for everyone */}
                    {l.pct >= BUSY_PERCENT && <span className="ml-1 font-semibold text-flame-ink">full</span>}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-rule">
                  <div
                    className={'h-1.5 rounded-full ' + (l.pct >= BUSY_PERCENT ? 'bg-flame' : 'bg-titan')}
                    style={{ width: `${l.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}
