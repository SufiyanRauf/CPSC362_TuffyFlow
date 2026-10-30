import ConfirmDialog from './ConfirmDialog'
import { useEffect, useRef, useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { getProfile } from '../lib/campusData'
import { CalendarIcon, SignOutIcon, UserIcon } from './icons'
import { CAMPUS_TZ } from '../lib/time'
import { useDataVersion } from '../lib/useDataVersion'
import { useMinuteTick } from '../lib/useMinuteTick'
import { useSession } from '../lib/session'
import { personName } from '../lib/labels'

type TopBarProps = {
  onOpenProfile: () => void
  onSignOut: () => void
}

// Built once rather than on every call, because this runs on the minute tick
// and building the formatter costs far more than formatting the date does.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TZ, weekday: 'long', month: 'long', day: 'numeric',
})

function today() {
  return DATE_FORMAT.format(new Date())
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

// Deliberately not a search box. Everything on screen is already ranked for
// this person, and a search field that does nothing is worse than no field.
export default function TopBar({ onOpenProfile, onSignOut }: TopBarProps) {
  const profile = useAsync(getProfile, [useDataVersion()])
  const session = useSession()
  // The header is the one place the date is written down, and a tab left open
  // overnight kept yesterday's until something else happened to rerender.
  useMinuteTick()
  const [open, setOpen] = useState(false)
  // Asked before, because this one ends the session: an account has to type a
  // password again, and the demo loses anything typed into it that was not
  // saved. The menu closes first, so the question is not sitting under a panel.
  const [leaving, setLeaving] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const firstItem = useRef<HTMLButtonElement>(null)

  // Everything that should put the panel away again. Each one is a way out a
  // person actually takes, and without them the panel sits over the page.
  useEffect(() => {
    if (!open) return
    firstItem.current?.focus()
    function onPointer(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    // tabbing past the last item used to leave the panel sitting open with the
    // focus behind it. relatedTarget is where focus is going, so a move inside
    // the panel, including the hand back to the trigger, is left alone. It is
    // null when focus goes nowhere at all, like a click on the panel's own
    // padding or the window going to the background, and closing on that would
    // dump focus on the body, so that case is left alone too.
    function onFocusOut(e: FocusEvent) {
      const to = e.relatedTarget as Node | null
      if (to && !wrap.current?.contains(to)) setOpen(false)
    }
    // Back and Forward change the screen without a click anywhere, so nothing
    // above closes the panel and it hangs over whatever you landed on. Focus is
    // usually still on an item at that point, and that item is about to go.
    function onRoute() {
      if (wrap.current?.contains(document.activeElement)) trigger.current?.focus()
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusout', onFocusOut)
    window.addEventListener('hashchange', onRoute)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('hashchange', onRoute)
    }
  }, [open])

  function choose(action: () => void) {
    // the button being clicked is about to unmount, so hand focus back to the
    // name that opened the menu before it goes
    trigger.current?.focus()
    setOpen(false)
    action()
  }

  const item = 'flex w-full items-center gap-2.5 px-3 py-3 text-left text-sm text-ink hover:bg-titan-50'

  // Read on its own the trigger is just a name, or two initials on a phone, so
  // the second line says a bit more. The major is the more useful of the two
  // when it is set, and the email is what tells one account from another when
  // it is not.
  const email = session.kind === 'account' ? session.email : ''
  const ready = profile.state === 'ready' ? profile.data : null
  const name = personName(ready?.full_name ?? null, email)
  const under = ready ? ready.major || email || 'Sample student' : email
  // The panel says which account, which is a different question and the one
  // that matters once two people share a browser. In the demo the honest
  // answer is that there is no account at all.
  const who = session.kind === 'account' ? email : 'Sample student, not an account'

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-rule
                       bg-white px-4 py-3 md:px-8">
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <CalendarIcon className="h-4 w-4 text-ink-faint" />
        {today()}
      </p>

      {/* Not conditional on the profile having loaded. It used to be, which was
          fine while the profile was a variable in a file and could not fail.
          It is a query now, and a student whose profile row would not load was
          left with no account menu and so no way to sign out of the account
          that was failing. The name falls back to the email. */}
      <div ref={wrap} className="relative">
        {/* Clicking your own name did nothing before, which left no way to
            sign out. Read on its own the button is just a name, or two
            initials on a phone, so the label says what it is for.
            aria-expanded and aria-controls are what make it a disclosure.
            aria-haspopup is deliberately not here, because ARIA treats it as
            a promise of a menu with arrow keys. */}
        <button
          ref={trigger}
          type="button"
          /* the focus() is for Safari and Firefox, which do not focus a button
             when it is clicked, so closing from inside the panel would hand
             focus to an element that is about to unmount */
          onClick={(e) => { e.currentTarget.focus(); setOpen((shown) => !shown) }}
          /* The panel below says in as many words that the demo is not an
             account, so the button that opens it should not be calling itself
             one either. */
          aria-label={session.kind === 'demo' ? 'Sample student menu' : `Account for ${name}`}
          aria-expanded={open}
          aria-controls={open ? 'account-menu' : undefined}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-titan-50"
        >
          <span className="hidden text-right leading-tight sm:block">
            <span className="block text-sm font-medium text-titan">{name}</span>
            <span className="block text-xs text-ink-faint">{under}</span>
          </span>
          <span aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-titan text-xs
                           font-semibold text-white">
            {initials(name)}
          </span>
        </button>

        {open && (
          /* Two buttons in a popover, so this is a disclosure. role="menu"
             would owe arrow keys and a roving tabindex, and the name header
             below is not a legal child of one. The border has to carry the
             edge, because a white panel sits on a white page: rule is too
             faint for that at 1.3:1, so this takes the stronger one. */
          <div
            id="account-menu"
            className="menu absolute right-0 z-30 mt-4 w-56 overflow-hidden rounded-xl
                       border border-rule-strong bg-white py-1 shadow-[0_8px_24px_rgba(0,39,76,0.12)]"
          >
            {/* Which account this is, on every screen size rather than just
                the phone. Two accounts in one browser is exactly what the
                security policies have to be tested with, and before this
                there was nothing on screen saying which one you were in. */}
            <p className="border-b border-rule px-3 pb-2 pt-1.5">
              <span className="block truncate text-sm font-medium text-titan sm:hidden">{name}</span>
              <span className="block truncate text-xs text-ink-faint">{who}</span>
            </p>
            <button ref={firstItem} type="button" className={item}
                    onClick={() => choose(onOpenProfile)}>
              <UserIcon className="h-4 w-4 text-ink-faint" />
              {/* The screen it opens is called Profile and so is the nav item,
                  and there is no settings screen anywhere in the app. */}
              Profile
            </button>
            <button type="button" className={item + ' border-t border-rule'}
                    onClick={() => choose(() => setLeaving(true))}>
              <SignOutIcon className="h-4 w-4 text-ink-faint" />
              {/* The demo is not an account, so logging out of it is not a
                  thing it can do. Saying what it really does avoids the
                  surprise of pressing Log out and landing inside an account,
                  which is what happens when this browser is logged in in
                  another tab.
                  Log out rather than Sign out, because the login screen and the
                  database errors both say log in and the app was using both
                  words for the same pair of actions. */}
              {session.kind === 'demo' ? 'Leave demo' : 'Log out'}
            </button>
          </div>
        )}
      </div>

      {leaving && (
        <ConfirmDialog
          title={session.kind === 'demo' ? 'Leave the demo?' : 'Log out?'}
          detail={session.kind === 'demo'
            ? 'The sample student goes back to how it started, and anything you typed here is dropped.'
            : 'You will need your email and password to get back in.'}
          confirmLabel={session.kind === 'demo' ? 'Leave demo' : 'Log out'}
          onConfirm={() => { setLeaving(false); onSignOut() }}
          onCancel={() => setLeaving(false)}
        />
      )}
    </header>
  )
}
