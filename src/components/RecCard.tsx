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

// The scorer writes the distance three different ways: "min walk to" for a lot,
// "min from" for a spot and "min away" for an event. The walk row above already
// says it, so the card read "5 min walk / 5 min away". Dropping it also makes
// room for the reason that was being pushed out, which on an event is the day
// it falls on.
function saysWalk(reason: string) {
  return reason.includes('min walk') || reason.includes('min from') ||
    reason.includes('min away')
}

function rowsFor(rec: Recommendation) {
  const rows: { Icon: (props: IconProps) => React.ReactElement; text: string }[] = []
  if (rec.walk_minutes !== null) {
    rows.push({ Icon: WalkIcon, text: `${rec.walk_minutes} min walk` })
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

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group rounded-xl border p-4 text-left hover:border-titan-200 ${tints[rec.category]}`}
    >
      {body}
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-titan group-hover:underline">
        {opensLabel[rec.category]}
        <ChevronRightIcon className="h-3 w-3" />
      </span>
    </button>
  )
}
