import { useEffect, useId, useRef, useState } from 'react'
import { NO_PROJECT, enterDemo, logIn, signInWithGoogle, signUp } from '../lib/session'
import { signInAvailable } from '../lib/firebase'

// Google's four color mark. Inline rather than an image so it needs no network
// request and no file in the build. The fills are hardcoded on purpose: their
// brand terms do not allow recoloring it.
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="h-[1.1rem] w-[1.1rem] shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

const outline =
  'min-h-11 w-full rounded-lg border border-rule-strong px-4 py-2.5 text-sm font-medium ' +
  'text-ink hover:border-titan disabled:cursor-not-allowed disabled:text-ink-faint'

const field =
  'mt-1 w-full rounded-md border border-rule-strong bg-white px-3 py-2.5 text-sm text-ink ' +
  'placeholder:text-ink-faint'

// Firebase's own minimum. Checked here as well so the answer is instant and
// the wording is ours rather than a message from the API.
const MIN_PASSWORD = 6

type Mode = 'choose' | 'login' | 'signup'
type Note = { bad: boolean; text: string }

export default function LoginView() {
  const [mode, setMode] = useState<Mode>('choose')
  const [note, setNote] = useState<Note | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const noteId = useId()
  const ids = { name: useId(), email: useId(), password: useId() }
  const hints = { demo: useId(), password: useId() }
  const heading = useRef<HTMLHeadingElement>(null)
  // which field the last complaint was about, so it can be marked as the one
  const [wrong, setWrong] = useState<'email' | 'password' | 'name' | null>(null)

  // Saying the same thing twice leaves the text in the live region unchanged,
  // and an unchanged live region says nothing at all, so pressing Log in twice
  // on an empty form was silent the second time. Emptying it first, in a
  // commit of its own, gives it something to change from.
  //
  // The id is held so the second commit can be called off. Only a form that
  // failed its own checks gets here, and that leaves this card on screen, so
  // the timer has nothing to land on today. Holding it is what keeps that true
  // if something later signs in or switches cards from the same place.
  const complaining = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function complain(field: 'email' | 'password' | 'name', text: string) {
    setWrong(field)
    setNote(null)
    clearTimeout(complaining.current)
    complaining.current = setTimeout(() => setNote({ bad: true, text }), 0)
  }

  useEffect(() => () => clearTimeout(complaining.current), [])

  // aria-invalid on its own gets read out as "invalid entry" and nothing else,
  // so somebody tabbing back to the box hears that it is wrong without hearing
  // why. The note underneath is already the message, so the field at fault
  // points at it, and only that field: pointing all three at it would have
  // every box reading out a complaint meant for one of them. It is a list of
  // ids rather than one, because the password box already points at its own
  // rule and that should still be read.
  function describe(field: 'email' | 'password' | 'name', own?: string) {
    const parts = [own, wrong === field ? noteId : undefined].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : undefined
  }

  // There used to be a block here that read a refused Google sign in back out
  // of the query string, because the redirect version of it comes home that
  // way and leaves the parameters in the address bar. Firebase opens a popup
  // instead, so a refusal comes back as a rejected promise like any other and
  // the address bar is never touched.

  // Switching between the two forms replaces the whole card. Without moving
  // focus, a keyboard is left on a button that no longer exists and a screen
  // reader never hears that the screen changed.
  function go(next: Mode) {
    setMode(next)
    setNote(null)
    setWrong(null)
    setPassword('')
  }

  // Focusing the heading is how somebody not using a mouse finds out the card
  // changed, and it has to happen in an effect. Calling focus() straight after
  // setMode does not work: the state change has not been flushed yet, so the
  // heading still reads "Tuffy Flow" and a screen reader announces the card
  // they just left. The ref skips the first render so nothing is grabbed on
  // the way in.
  const shown = useRef(mode)
  useEffect(() => {
    if (shown.current === mode) return
    shown.current = mode
    heading.current?.focus()
  }, [mode])

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true)
    setNote(null)
    // whatever comes back is about the pair, not about one box, so nothing
    // should still be marked as the offender
    setWrong(null)
    try {
      const result = await action()
      if (!result.ok) {
        setNote({ bad: true, text: result.message ?? 'That did not work. Try again.' })
      }
      // Success signs the session in and the app replaces this screen on its
      // own, Google included: it is a popup, so this page never goes away.
    } catch (e) {
      setNote({ bad: true, text: e instanceof Error ? e.message : 'That did not work. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    // Each one names the field it is about and focuses it, because "fill in
    // both" told somebody working down the form by keyboard nothing about
    // which box to go back to.
    if (!email.trim()) {
      complain('email', 'Your email address is missing.')
      document.getElementById(ids.email)?.focus()
      return
    }
    if (!password) {
      complain('password', 'Your password is missing.')
      document.getElementById(ids.password)?.focus()
      return
    }
    if (mode === 'signup') {
      if (!name.trim()) {
        complain('name', 'Your name is missing.')
        document.getElementById(ids.name)?.focus()
        return
      }
      if (password.length < MIN_PASSWORD) {
        complain('password', `Passwords need at least ${MIN_PASSWORD} characters.`)
        document.getElementById(ids.password)?.focus()
        return
      }
      void run(() => signUp(email.trim(), password, name))
      return
    }
    void run(() => logIn(email.trim(), password))
  }

  const title = mode === 'signup' ? 'Create an account' : mode === 'login' ? 'Log in' : 'Tuffy Flow'

  return (
    <main className="flex min-h-screen items-start justify-center bg-titan px-4 py-10 sm:items-center">
      {/* A wide soft black shadow does nothing over navy, so the card read as a
          flat cut-out. Tight and darker actually lifts it off the page. */}
      <div className="my-auto w-full max-w-sm rounded-xl bg-white px-7 py-8 text-center
                      shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
        {/* the same mark the sidebar uses, so the login belongs to the app.
            Hidden from readers, which otherwise hear "TF" before the heading
            that says the same thing in full. */}
        <span aria-hidden="true"
              className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-flame text-xl
                         font-bold text-titan">
          TF
        </span>
        {/* tabIndex so the two forms can hand focus to their own heading, which
            is how anyone not using a mouse finds out the card changed */}
        <h1 ref={heading} tabIndex={-1} className="mt-5 text-3xl font-bold tracking-tight text-titan">
          {title}
        </h1>

        {mode === 'choose' ? (
          <>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
              Where to park, where to work, and what's happening between your classes.
            </p>

            <button
              id="login-demo"
              type="button"
              onClick={enterDemo}
              aria-describedby={hints.demo}
              className="mt-6 w-full rounded-lg bg-titan px-4 py-3 font-semibold text-white hover:bg-titan-700"
            >
              View demo
            </button>
            <p id={hints.demo} className="mx-auto mt-2 max-w-xs text-xs text-ink-faint">
              Opens a sample student schedule. No sign up needed.
            </p>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-rule" />
              <span className="text-xs text-ink-faint">or</span>
              <span className="h-px flex-1 bg-rule" />
            </div>

            {/* the mark is taken out of the flow so the label centers on the
                button, not on the label and the mark together */}
            <button
              type="button"
              onClick={() => {
                if (busy) return
                if (!signInAvailable) return setNote({ bad: true, text: NO_PROJECT })
                void run(signInWithGoogle)
              }}
              /* aria-disabled rather than disabled, for the reason written out
                 in ProfileView: a disabled button that has focus hands focus
                 back to the body, and this one disables the instant it is
                 pressed, which would throw a screen reader away from the
                 message it is about to be given. */
              aria-disabled={busy}
              aria-describedby={noteId}
              className={'relative flex items-center justify-center ' + outline}
            >
              <span className="absolute left-4 flex items-center"><GoogleMark /></span>
              {busy ? 'Taking you to Google…' : 'Continue with Google'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (busy) return
                if (!signInAvailable) return setNote({ bad: true, text: NO_PROJECT })
                go('signup')
              }}
              aria-disabled={busy}
              aria-describedby={noteId}
              className={'mt-3 ' + outline}
            >
              {/* The same words as the submit button on the card this opens, so
                  it does not look like two different things. */}
              Create account
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-5 text-left">
            {/* It used to promise a permit and class times, neither of which is
                on this card. There are three boxes here, so say three. */}
            {mode === 'signup' && (
              <p className="mb-4 text-center text-sm text-ink-soft">
                We only need a name, an email and a password. Your permit and
                class times come later, on your profile.
              </p>
            )}

            {mode === 'signup' && (
              <label htmlFor={ids.name} className="block text-sm font-medium text-ink">
                Name
                <input
                  id={ids.name}
                  value={name}
                  onChange={(e) => { setWrong(null); setName(e.target.value) }}
                  autoComplete="name"
                  // aria-required rather than the native required attribute,
                  // for all three boxes. required hands the browser its own
                  // validation bubble, which would fire before the checks in
                  // submit() and say less than they do.
                  aria-required="true"
                  aria-invalid={wrong === 'name' || undefined}
                  aria-describedby={describe('name')}
                  maxLength={80}
                  placeholder="Alex Nguyen"
                  className={field}
                />
              </label>
            )}

            <label htmlFor={ids.email} className={'block text-sm font-medium text-ink' + (mode === 'signup' ? ' mt-4' : '')}>
              Email
              <input
                id={ids.email}
                type="email"
                value={email}
                // clearing the mark as well, or a field stays announced as
                // invalid after it has been corrected
                onChange={(e) => { setWrong(null); setEmail(e.target.value) }}
                // username rather than email on the log in form, which is the
                // pairing a password manager expects next to current-password
                autoComplete={mode === 'signup' ? 'email' : 'username'}
                aria-required="true"
                aria-invalid={wrong === 'email' || undefined}
                aria-describedby={describe('email')}
                placeholder="you@csu.fullerton.edu"
                className={field}
              />
            </label>

            <label htmlFor={ids.password} className="mt-4 block text-sm font-medium text-ink">
              Password
              <input
                id={ids.password}
                type="password"
                value={password}
                onChange={(e) => { setWrong(null); setPassword(e.target.value) }}
                // new-password is what tells a password manager to offer one
                // rather than filling in the old one
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                aria-required="true"
                aria-invalid={wrong === 'password' || undefined}
                // the rule underneath is part of what this field expects, so
                // it has to be readable before failing rather than after, and
                // it stays readable alongside a complaint rather than being
                // replaced by one
                aria-describedby={describe('password', mode === 'signup' ? hints.password : undefined)}
                className={field}
              />
            </label>
            {mode === 'signup' && (
              <p id={hints.password} className="mt-1 text-xs text-ink-faint">
                At least {MIN_PASSWORD} characters.
              </p>
            )}

            <button
              type="submit"
              aria-disabled={busy}
              aria-describedby={noteId}
              className={
                'mt-5 min-h-11 w-full rounded-lg px-4 py-3 font-semibold ' +
                (busy
                  ? 'cursor-not-allowed bg-rule text-ink'
                  : 'bg-titan text-white hover:bg-titan-700')
              }
            >
              {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Log in'}
            </button>
          </form>
        )}

        {/* Present from first paint, so a screen reader is already watching
            it. A live region that appears with its text already in it does not
            reliably get read out. */}
        <p
          id={noteId}
          role="status"
          className={
            note
              // text-sm, the same as the rest of the prose on this card. It was
              // on a 13px size that existed nowhere else in the app, and this
              // is the line that tells somebody why their login failed.
              ? 'mt-4 rounded-lg px-3 py-2 text-left text-sm ' +
                // warm for a problem, green for a success. It used to use the
                // pale blue, which reads as a note rather than as a fault.
                (note.bad
                  ? 'bg-tint-parking text-flame-ink'
                  : 'bg-ok-soft text-ok')
              : 'sr-only'
          }
        >
          {note?.text}
        </p>

        <p className="mt-6 text-sm text-ink-soft">
          {mode === 'login' ? (
            <>
              No account yet?{' '}
              <button type="button" onClick={() => go('signup')} className="inline-block -my-1.5 py-1.5 font-medium text-titan underline underline-offset-2">
                Create one
              </button>
            </>
          ) : mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => go('login')} className="inline-block -my-1.5 py-1.5 font-medium text-titan underline underline-offset-2">
                Log in
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  if (busy) return
                  if (!signInAvailable) return setNote({ bad: true, text: NO_PROJECT })
                  go('login')
                }}
                aria-disabled={busy}
                aria-describedby={noteId}
                className="inline-block -my-1.5 py-1.5 font-medium text-titan underline underline-offset-2"
              >
                Log in
              </button>
            </>
          )}
        </p>

        {mode !== 'choose' && (
          <button
            type="button"
            onClick={() => go('choose')}
            className="mt-3 min-h-11 px-2 text-sm font-medium text-ink-soft hover:text-titan hover:underline"
          >
            Back
          </button>
        )}
      </div>
    </main>
  )
}
