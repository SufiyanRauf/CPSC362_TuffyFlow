import type { NextClass, Recommendation } from '../types'
import { ArrowRightIcon, WalkIcon } from './icons'
import { DAYS, clockText } from '../lib/time'
import { directionsUrl } from '../lib/maps'

type NextClassCardProps = {
  nextClass: NextClass
  lot: Recommendation | null
  onOpenProfile: () => void
  // Whether the ranking actually came back. Without it a dropped request looks
  // exactly like a missing permit, and the card confidently blames the permit
  // for a problem the student cannot fix. The section below already says
  // "Could not load this", so saying nothing here is the honest answer.
  rankingReady: boolean
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

// The walk is rounded up to whole minutes, so a lot in the same building as
// the class comes back as 0 and this card read "0 min walk". RecCard and the
// parking screen both say this at zero, and the same number has to read the
// same way wherever it is printed.
function walkText(minutes: number) {
  return minutes === 0 ? 'Less than a minute away' : `${minutes} min walk`
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
export default function NextClassCard({ nextClass, lot, onOpenProfile, rankingReady }: NextClassCardProps) {
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
  // The course whose building has gone from the campus data, or null. The
  // ranking is skipped rather than measured to a made up point in that case,
  // so there is no lot to put below for a reason that has nothing to do with
  // the permit, and the parking screen reads the same sentinel. The course is
  // carried rather than the building because the building is exactly what is
  // missing: its name has already fallen back to the word Campus.
  const strandedCourse = nextClass.building_lat === 0 ? nextClass.course_code : null

  return (
    <div className="rounded-xl border border-rule bg-paper px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div>
          <Eyebrow>Next class</Eyebrow>
          <h2 className="mt-1.5 text-3xl font-semibold tracking-tight text-titan">
            {nextClass.course_code}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {clockText(nextClass.start_time)} · {nextClass.building_name}
          </p>
        </div>

        <div className="text-right">
          <Eyebrow>{label}</Eyebrow>
          <p className="mt-1.5 whitespace-nowrap text-2xl font-semibold tracking-tight text-flame-ink">
            {value}
          </p>
        </div>
      </div>

      {lot ? (
        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-t border-rule pt-5">
          <div className="min-w-0">
            <Eyebrow>Park here</Eyebrow>
            <p className="mt-1.5 text-lg font-semibold text-titan">{lot.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
              {lot.walk_minutes !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <WalkIcon className="h-4 w-4 text-ink-faint" />
                  {walkText(lot.walk_minutes)}
                </span>
              )}
              {fullness && <span>{fullness}</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <div className="text-right">
              {/* same words as the parking rows, because it is the same number */}
              <Eyebrow>{lot.arrive_by ? 'Be at lot by' : 'Leave'}</Eyebrow>
              {/* text-xl, one step under the lot title above, the same
                  relationship the parking rows use. At text-2xl the clock
                  was the biggest thing in the block and the lot it applies
                  to read as its caption. */}
              <p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums tracking-tight text-titan">
                {lot.arrive_by ? clockText(lot.arrive_by) : 'now'}
              </p>
            </div>

            {lot.lat !== null && lot.lng !== null && (
              <a
                href={directionsUrl(lot.title, lot.lat, lot.lng)}
                target="_blank"
                rel="noreferrer noopener"
                // The parking screen has one of these per lot, so a reader
                // listing the links hears Directions over and over. Naming the
                // lot here keeps this card's link saying the same thing as
                // those, and the visible word stays inside the label.
                aria-label={`Directions to ${lot.title}`}
                className="inline-flex items-center gap-2 rounded-lg bg-titan px-4 py-2.5 text-sm
                           font-medium text-white hover:bg-titan-700"
              >
                Directions
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      ) : rankingReady ? (
        // This explanation used to be a dashed card one third of a row wide
        // down in "Where to go next", which is the wrong place for it: this is
        // the block somebody reads to find out where the car goes, so this is
        // where the reason there is no answer belongs. Same two cases as
        // before, the permit and the missing building, and the same words.
        // The label, the spacing and the divider are the ones the Park here
        // block uses, because it is now sitting in exactly that block's slot
        // and the old card's own border would have been a card inside a card.
        <div className="mt-5 border-t border-rule pt-5">
          <Eyebrow>Parking</Eyebrow>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
            {strandedCourse
              ? `Nothing here because we do not have a location for the building ${strandedCourse} is in, so there is nowhere to measure the walk to.`
              : 'Nothing here until your profile says which permit you hold. Lots take some permits and not others.'}
          </p>
          {/* No button on the missing building, because the profile is not
              where that gets fixed. */}
          {!strandedCourse && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="mt-3 min-h-11 rounded-lg border border-titan px-4 text-sm font-medium
                         text-titan hover:bg-titan hover:text-white"
            >
              Set your permit
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
