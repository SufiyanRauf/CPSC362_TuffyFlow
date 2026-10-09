type Tone = 'now' | 'upcoming' | 'done' | 'match' | 'mark'

const tones: Record<Tone, string> = {
  now: 'bg-flame/20 text-flame-ink',
  upcoming: 'bg-titan-50 text-titan',
  done: 'bg-ok-soft text-ok',
  match: 'bg-flame/15 text-flame-ink tabular-nums',
  mark: 'bg-titan text-white uppercase tracking-wide',
}

export default function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}
