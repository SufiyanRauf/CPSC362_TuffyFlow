import type { Recommendation, RecCategory } from '../types'
import { spotKindLabels } from '../lib/labels'
import { CheckIcon, ChevronRightIcon, ClockIcon, WalkIcon, type IconProps } from './icons'
import Pill from './Pill'

type RecCardProps = {
  rec: Recommendation
  onOpen?: () => void
}

const labels: Record<RecCategory, string> = {
  parking: 'Best parking',
  spot: 'Study spot',
  event: 'Event',
}

const opensLabel: Record<RecCategory, string> = {
  parking: 'All lots',
  spot: 'All spots',
  event: 'All events',
}

// One tint per category and it never changes, so the color is telling you what
// kind of thing you are looking at rather than just brightening the page up.
const tints: Record<RecCategory, string> = {
  parking: 'border-tint-parking-edge bg-tint-parking',
  spot: 'border-tint-spot-edge bg-tint-spot',
  event: 'border-tint-event-edge bg-tint-event',
}

function labelFor(rec: Recommendation) {
  if (rec.category === 'spot' && rec.kind) {
    return spotKindLabels[rec.kind] ?? 'Study spot'
  }
  return labels[rec.category] ?? 'Suggestion'
}

// A lot's reason is "3 min walk to Computer Science" and the row above it
// already says "3 min walk", so the card was printing the number twice. Spots
// and events say "measured from Computer Science" with no number in it, which
// is the one thing the walk row cannot tell you, so those stay.
function saysWalk(reason: string) {
  return reason.includes('min walk')
}

// The walk is rounded up to whole minutes, so anywhere in the same building as
// the class you are measured from comes back as 0, and the card was reading
// "0 min walk" directly above the reason "right by Computer Science". A number
// is the wrong answer at that distance rather than a wrong number, so at zero
// the row says what it means instead.
function walkText(minutes: number) {
  return minutes === 0 ? 'Less than a minute away' : `${minutes} min walk`
}

function rowsFor(rec: Recommendation) {
  const rows: { Icon: (props: IconProps) => React.ReactElement; text: string }[] = []
  if (rec.walk_minutes !== null) {
    rows.push({ Icon: WalkIcon, text: walkText(rec.walk_minutes) })
  }
  if (rec.arrive_by) {
    rows.push({ Icon: ClockIcon, text: `Arrive by ${rec.arrive_by}` })
  }
  const rest = rec.walk_minutes !== null
    ? rec.reasons.filter((r) => !saysWalk(r))
    : rec.reasons
  for (const reason of rest.slice(0, 2)) {
    rows.push({ Icon: CheckIcon, text: reason })
  }
  return rows
}

export default function RecCard({ rec, onOpen }: RecCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          {labelFor(rec)}
        </p>
        <Pill tone="match">{rec.match_percent}%</Pill>
      </div>

      <h3 className="mt-2 font-semibold leading-snug text-titan">{rec.title}</h3>

      <hr className="my-3 border-black/10" />

      <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
        {rowsFor(rec).map(({ Icon, text }) => (
          <li key={text} className="flex items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 text-ink-faint" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </>
  )

  if (!onOpen) {
    return <div className={`rounded-xl border p-4 ${tints[rec.category]}`}>{body}</div>
  }

  // The card itself used to be the button, so its name was everything inside
  // it read out as one sentence, and the h3 sat inside a control, where heading
  // navigation does not reliably reach it. The line at the bottom is the real
  // button now, which is the whole of the name. The click stays on the card so
  // that all of it still opens the list, and it is only there: a press on the
  // button bubbles up to the same handler, from the keyboard as well, so one
  // press is one call either way.
  return (
    <div
      onClick={onOpen}
      // cursor-pointer because the click is on the whole card. Without it a
      // mouse gets a text caret over a region that navigates, so the only clue
      // that any of this is clickable is the line at the bottom.
      className={`group cursor-pointer rounded-xl border p-4 text-left hover:border-titan-200 ${tints[rec.category]}`}
    >
      {body}
      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-titan group-hover:underline"
      >
        {opensLabel[rec.category]}
        <ChevronRightIcon className="h-3 w-3" />
      </button>
    </div>
  )
}
