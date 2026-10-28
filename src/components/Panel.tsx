import type { Loadable } from '../types'

type PanelProps<T> = {
  source: Loadable<T>
  empty?: string
  children: (data: T) => React.ReactNode
}

// The sentences a student can actually do something about, from readable() in
// firestoreData.ts and the fetch failures in recommend.ts. Everything else that
// reaches here is written for whoever is building the app: a seed script to
// run, a rules file to publish, a uvicorn command to start, or the raw text of
// whatever the Firebase SDK threw, because readable() hands back the original
// message when it recognises nothing.
//
// So this is a list of what may be shown rather than a list of what may not.
// The app is deployed where anybody can open it, and a message nobody has
// thought about yet comes out generic that way instead of putting a shell
// command in front of a visitor.
//
// None of it applies while running locally, where the shell command is the
// whole point of the message.
const STUDENT_FACING = [
  'Could not reach the server.',
  'You have been signed out.',
  'That is not in the database any more.',
  'The database has hit its daily limit.',
]

export default function Panel<T>({ source, empty, children }: PanelProps<T>) {
  if (source.state === 'loading') {
    // Otherwise a reader is told nothing: the dashboard puts three of these up
    // and then quietly swaps each one for content. The note in App.tsx is about
    // a line that is the only thing on the page, so it gets read as the page
    // anyway. A panel arrives in a page that is already up, where a status
    // region appearing does get announced.
    return <p role="status" className="py-6 text-sm text-ink-faint">Loading…</p>
  }
  if (source.state === 'error') {
    const known = import.meta.env.DEV
      || STUDENT_FACING.some((start) => source.message.startsWith(start))
    // The generic line throws away the one detail that says which half of the
    // app is down, which is the detail you want while building, so it goes to
    // the console on the way past.
    if (!known) console.warn('Panel could not load:', source.message)
    return (
      <div className="rounded-lg border border-l-4 border-rule border-l-flame-ink bg-white px-4 py-3 text-sm">
        <p className="font-medium text-flame-ink">Could not load this.</p>
        <p className="mt-1 text-ink-soft">
          {known ? source.message : 'Something went wrong on our end. Try again in a moment.'}
        </p>
      </div>
    )
  }
  if (Array.isArray(source.data) && source.data.length === 0) {
    return <p className="py-6 text-sm text-ink-faint">{empty ?? 'Nothing to show.'}</p>
  }
  return <>{children(source.data)}</>
}
