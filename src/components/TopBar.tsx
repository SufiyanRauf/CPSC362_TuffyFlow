import { useEffect, useRef, useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { getProfile } from '../lib/campusData'
import { CalendarIcon, SignOutIcon, UserIcon } from './icons'
import { CAMPUS_TZ } from '../lib/time'
import { useDataVersion } from '../lib/useDataVersion'

type TopBarProps = {
  onOpenProfile: () => void
  onSignOut: () => void
}

function today() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPUS_TZ, weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date())
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
  const [open, setOpen] = useState(false)
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

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-rule
                       bg-white px-4 py-3 md:px-8">
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <CalendarIcon className="h-4 w-4 text-ink-faint" />
        {today()}
      </p>

      {profile.state === 'ready' && (
        <div ref={wrap} className="relative">
          {/* Clicking your own name did nothing before, which left no way to
              sign out. Read on its own the button is just a name, or two
              initials on a phone, so the label says what it is for.
              aria-expanded and aria-controls are what make it a disclosure;
              aria-haspopup is deliberately not here, because ARIA treats it as
              a promise of a menu with arrow keys. Safari and Firefox do not
              focus a button when you click it, so closing this way would leave
              focus on the item that is about to unmount. */}
          <button
            ref={trigger}
            type="button"
            onClick={(e) => { e.currentTarget.focus(); setOpen((shown) => !shown) }}
            aria-label={`Account for ${profile.data.full_name}`}
            aria-expanded={open}
            aria-controls={open ? 'account-menu' : undefined}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-titan-50"
          >
            <span className="hidden text-right leading-tight sm:block">
              <span className="block text-sm font-medium text-titan">{profile.data.full_name}</span>
              <span className="block text-xs text-ink-faint">{profile.data.major}</span>
            </span>
            <span aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-titan text-xs
                             font-semibold text-white">
              {initials(profile.data.full_name)}
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
              <p className="border-b border-rule px-3 pb-2 pt-1.5 text-xs text-ink-faint sm:hidden">
                {profile.data.full_name}
              </p>
              <button ref={firstItem} type="button" className={item}
                      onClick={() => choose(onOpenProfile)}>
                <UserIcon className="h-4 w-4 text-ink-faint" />
                Profile and settings
              </button>
              <button type="button" className={item + ' border-t border-rule'}
                      onClick={() => choose(onSignOut)}>
                <SignOutIcon className="h-4 w-4 text-ink-faint" />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
