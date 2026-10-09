import { useState } from 'react'

type LoginViewProps = {
  onDemo: () => void
  // Bhavy passes this once Firebase is in. Until then it is undefined and the
  // buttons explain themselves instead of doing nothing.
  onGoogleSignIn?: () => Promise<void>
}

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

// Sign in is Bhavy's job, with Firebase. The three buttons that need it get a
// handler each, all saying the same thing for now, because they will not end
// up sharing one: Google is a popup, the other two need email and password.
export default function LoginView({ onDemo, onGoogleSignIn }: LoginViewProps) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const notReady = () => setMessage('Sign in is not hooked up yet. Use View demo for now.')

  async function signInWithGoogle() {
    if (!onGoogleSignIn) return notReady()
    setBusy(true)
    setMessage('')
    try {
      await onGoogleSignIn()
    } catch {
      setMessage('That did not work. Try again, or use View demo.')
    } finally {
      setBusy(false)
    }
  }

  const createAccount = () => notReady()
  const logIn = () => notReady()

  return (
    <main className="flex min-h-screen items-start justify-center bg-titan px-4 py-10 sm:items-center">
      {/* A wide soft black shadow does nothing over navy, so the card read as a
          flat cut-out. Tight and darker actually lifts it off the page. */}
      <div className="my-auto w-full max-w-sm rounded-xl bg-white px-7 py-8 text-center
                      shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
        {/* the same mark the sidebar uses, so the login belongs to the app */}
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-flame text-xl
                         font-bold text-titan">
          TF
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-titan">Tuffy Flow</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
          Where to park, where to work, and what is on between your classes.
        </p>

        <button
          id="login-demo"
          type="button"
          onClick={onDemo}
          className="mt-6 w-full rounded-lg bg-titan px-4 py-3 font-semibold text-white hover:bg-titan-700"
        >
          View demo
        </button>
        <p className="mx-auto mt-2 max-w-xs text-[0.8125rem] text-ink-faint">
          Opens a sample student schedule. No sign up needed.
        </p>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-rule" />
          <span className="text-[0.8125rem] text-ink-faint">or</span>
          <span className="h-px flex-1 bg-rule" />
        </div>

        {/* the mark is taken out of the flow so the label centers on the button,
            not on the label and the mark together */}
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          aria-describedby={message ? 'signin-note' : undefined}
          className={'relative flex items-center justify-center ' + outline}
        >
          <span className="absolute left-4 flex items-center"><GoogleMark /></span>
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        <button
          type="button"
          onClick={createAccount}
          aria-describedby={message ? 'signin-note' : undefined}
          className={'mt-3 ' + outline}
        >
          Create an account
        </button>

        {/* present from first paint, so a screen reader is already watching it */}
        <p
          id="signin-note"
          role="status"
          className={message ? 'mt-3 rounded-lg bg-titan-50 px-3 py-2 text-[0.8125rem] text-titan' : 'sr-only'}
        >
          {message}
        </p>

        <p className="mt-6 text-sm text-ink-soft">
          Already have an account?{' '}
          <button
            type="button"
            onClick={logIn}
            aria-describedby={message ? 'signin-note' : undefined}
            className="inline-block -my-1.5 py-1.5 font-medium text-titan underline underline-offset-2"
          >
            Log in
          </button>
        </p>
      </div>
    </main>
  )
}
