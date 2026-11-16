import { useEffect, useId, useRef, useState } from 'react'
import { deleteMyAccount } from '../lib/campusData'
import { studentFacing } from '../lib/firestoreData'
import { accountProvider } from '../lib/session'
import ConfirmDialog from './ConfirmDialog'
import SectionHeader from './SectionHeader'
import { SignOutIcon } from './icons'

// The way out for good. Only ever rendered for a signed in account: the demo
// has nothing to delete, and ProfileView decides that, not this file.
//
// A file of its own rather than one more section inside ProfileView, which is
// long enough already and shares nothing with this but the page it is on.
export default function DeleteAccount() {
  // Asked once. How somebody signs in does not change while they are looking
  // at their profile.
  const [provider] = useState(accountProvider)
  const [password, setPassword] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const passwordId = useId()
  const noteId = useId()

  // Saying the same thing twice leaves the text in the live region unchanged,
  // and an unchanged live region says nothing at all, so pressing the button
  // twice on an empty password box was silent the second time. Emptying it
  // first, in a commit of its own, gives it something to change from. The
  // login card does the same thing and for the same reason.
  const complaining = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function complain(text: string) {
    setNote('')
    clearTimeout(complaining.current)
    complaining.current = setTimeout(() => setNote(text), 0)
  }

  useEffect(() => () => clearTimeout(complaining.current), [])

  function ask() {
    if (busy) return
    // Before the dialog rather than after it, so nobody agrees to something
    // irreversible and is then told to go back and type a password.
    if (provider === 'password' && !password) {
      complain('Type your password first, so we know it is you.')
      document.getElementById(passwordId)?.focus()
      return
    }
    setNote('')
    setConfirming(true)
  }

  async function reallyDelete() {
    // The same guard ask() has and ProfileView's reallyRemove() has, on the
    // one action where running twice is worst. Nothing reaches this twice
    // today, because the dialog unmounts in the same flush, but that is
    // timing and this is the check.
    if (busy) return
    setBusy(true)
    setNote('')
    try {
      await deleteMyAccount(provider === 'password' ? password : undefined)
      // Nothing to do here on success, and nothing to say: this screen is
      // already gone. The session has ended and the app has swapped in the
      // login card, which is where it gets said. deleteMyAccount leaves the
      // word for it in sessionStorage, and leaves it there before the sign
      // out rather than after, because the login card has already mounted and
      // read it by the time this line runs. It was written here once, which
      // meant the confirmation never appeared and the flag sat waiting to
      // greet the next login card in this tab instead.
    } catch (e) {
      setNote(studentFacing(
        e instanceof Error ? e.message : '',
        'Your account was not deleted. Try again.',
      ))
      setBusy(false)
    }
  }

  return (
    <section>
      <SectionHeader icon={<SignOutIcon className="h-4 w-4" />} title="Delete account"
                     note="This cannot be undone." />
      <div className="rounded-xl border border-rule bg-white px-5 py-4">
        <p className="text-sm text-ink-soft">
          Deleting your account erases your profile, your weekly schedule and
          your login. Nothing of yours is kept, and you would need to sign up
          again to come back.
        </p>

        {provider === 'password' ? (
          <label htmlFor={passwordId} className="mt-4 block text-sm font-medium text-ink">
            Your password
            <input
              id={passwordId}
              type="password"
              value={password}
              onChange={(e) => { setNote(''); setPassword(e.target.value) }}
              autoComplete="current-password"
              aria-describedby={noteId}
              className="mt-1 block w-full max-w-xs rounded-md border border-rule-strong bg-white
                         px-3 py-2.5 text-sm text-ink"
            />
          </label>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">
            Google will ask you to sign in once more first, so we know it is you.
          </p>
        )}

        {/* aria-disabled rather than disabled, for the reason ProfileView
            gives: a disabled button that has focus drops it on the body. */}
        <button
          type="button"
          aria-disabled={busy}
          aria-describedby={noteId}
          onClick={ask}
          className={
            'mt-4 min-h-11 rounded-lg px-4 text-sm font-medium ' +
            (busy
              ? 'cursor-not-allowed bg-rule text-ink-soft'
              : 'border border-flame-ink text-flame-ink hover:bg-tint-parking')
          }
        >
          {busy ? 'Deleting…' : 'Delete account'}
        </button>

        {/* The popup can open behind the window, and the paragraph that warns
            about it has scrolled past by now. It used to end "Nothing has been
            deleted yet", which is true while the window is open and a lie for
            the rest of the time it was on screen: busy covers proving who you
            are, then the schedule, then the account, and it said that all the
            way through. Neither this nor the button claims a step now. */}
        {busy && provider !== 'password' && (
          <p className="mt-2 text-sm text-ink-soft">
            If a Google window is open, finish there to confirm it is you.
          </p>
        )}

        {/* Present from first paint, like the other status lines, so a screen
            reader is already watching it when it has something to say. */}
        <p
          id={noteId}
          role="status"
          className={note
            ? 'mt-3 rounded-lg bg-tint-parking px-3 py-2 text-sm text-flame-ink'
            : 'sr-only'}
        >
          {note}
        </p>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Delete your account?"
          detail="Your profile, your weekly schedule and your login are erased for good. This cannot be undone."
          confirmLabel="Delete everything"
          destructive
          onConfirm={() => {
            setConfirming(false)
            void reallyDelete()
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  )
}
