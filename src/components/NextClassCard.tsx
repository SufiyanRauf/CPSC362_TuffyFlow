import type { NextClass, Recommendation } from '../types'
import { ArrowRightIcon, WalkIcon } from './icons'
import { DAYS } from '../lib/time'
import { directionsUrl } from '../lib/maps'

type NextClassCardProps = {
  nextClass: NextClass
  lot: Recommendation | null
}

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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-faint">
      {children}
    </p>
  )
}

// The one panel on the page that answers the whole question: when is class, and
// where should the car go. Everything below it is detail.
export default function NextClassCard({ nextClass, lot }: NextClassCardProps) {
  // There used to be a "No more classes today" card here, guarded on
  // minutes_until being null. Nothing could reach it: a Friday evening still
  // has a next class, it is just days out, which is why this says Monday
  // rather than counting down. Having no classes at all is a different case
  // and the dashboard answers it before this card is rendered.

  const { value, label } = countdown(
    nextClass.minutes_until, nextClass.day_offset, nextClass.day_of_week,
  )
  // From the number on the result rather than by picking the sentence that
  // happens to contain a percent sign. The parking screen used to do the same
  // thing and it tied the wording of the scorer to the wording of a card.
  const fullness = lot?.pct_full === null || lot?.pct_full === undefined
    ? null
    : `usually about ${lot.pct_full}% full when you would arrive`

  return (
    <div className="rounded-xl border border-rule bg-paper px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div>
          <Eyebrow>Next class</Eyebrow>
          <h2 className="mt-1.5 text-3xl font-semibold tracking-tight text-titan">
            {nextClass.course_code}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {nextClass.start_time} · {nextClass.building_name}
          </p>
        </div>

        <div className="text-right">
          <Eyebrow>{label}</Eyebrow>
          <p className="mt-1.5 whitespace-nowrap text-2xl font-semibold tracking-tight text-flame-ink">
            {value}
          </p>
        </div>
      </div>

      {lot && (
        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-t border-rule pt-5">
          <div className="min-w-0">
            <Eyebrow>Park here</Eyebrow>
            <p className="mt-1.5 text-lg font-semibold text-titan">{lot.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
              {lot.walk_minutes !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <WalkIcon className="h-4 w-4 text-ink-faint" />
                  {lot.walk_minutes} min walk
                </span>
              )}
              {fullness && <span>{fullness}</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <div className="text-right">
              <Eyebrow>{lot.arrive_by ? 'Arrive by' : 'Leave'}</Eyebrow>
              <p className="mt-1 whitespace-nowrap text-2xl font-semibold tabular-nums tracking-tight text-titan">
                {lot.arrive_by ?? 'now'}
              </p>
            </div>

            {lot.lat !== null && lot.lng !== null && (
              <a
                href={directionsUrl(lot.title, lot.lat, lot.lng)}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-lg bg-titan px-4 py-2.5 text-sm
                           font-medium text-white hover:bg-titan-700"
              >
                Directions
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
