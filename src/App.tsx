import { useEffect, useRef } from 'react'
import { useHashRoute } from './lib/useHashRoute'
import { resetDemoData } from './lib/campusData'
import { leaveDemo, signOut, useSession } from './lib/session'
import LoginView from './components/LoginView'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import RightRail from './components/RightRail'
import Dashboard from './components/Dashboard'
import ParkingView from './components/ParkingView'
import SpotsView from './components/SpotsView'
import ClubsView from './components/ClubsView'
import EventsView from './components/EventsView'
import ProfileView from './components/ProfileView'

export default function App() {
  const [view, setView] = useHashRoute()
  const session = useSession()
  const inside = session.kind === 'demo' || session.kind === 'account'

  // React unmounts whichever side had focus, which drops it on the body. Hand
  // it across instead, both ways: in to the content, which already takes focus
  // for the skip link, and back out to the button that gets you in again.
  //
  // It compares against the last value rather than counting renders, because a
  // first-paint flag got burned by StrictMode's second run of the effect. And
  // it ignores the step out of "loading", which is not a move anybody made: on
  // an ordinary reload of a signed in account that step would jump focus into
  // the middle of the page before they had touched anything.
  const was = useRef(session.kind)
  useEffect(() => {
    const before = was.current
    was.current = session.kind
    if (before === 'loading') return
    if ((before === 'demo' || before === 'account') === inside) return
    document.getElementById(inside ? 'content' : 'login-demo')?.focus()
  }, [session.kind, inside])

  // Firebase keeps a session in this browser and reading it back is not
  // instant, so for a moment we genuinely do not know. Showing the login
  // screen in the meantime would flash it at someone who is already signed in.
  if (session.kind === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-titan px-4">
        {/* Not a live region. It is the only thing on the page, so it is read
            as the page; marked as a status it would be a region created with
            its text already in it, which is the case that does not reliably
            get announced. */}
        <p className="text-sm text-titan-200">Checking whether you are signed in…</p>
      </main>
    )
  }

  if (!inside) return <LoginView />

  // the rail is how full each structure usually is, plus what is coming up,
  // which belongs beside the dashboard and the lots and would just be clutter
  // on the other four
  const withRail = view === 'home' || view === 'parking'

  return (
    // Keyed on who is using the app, so that changing who means starting
    // again. Firebase keeps auth state in step across tabs, so this one can
    // be handed a different account without anybody here touching it, and
    // the loaders keep showing the last answer while the next one is in
    // flight. Without the key that window puts one student's name over
    // another's email, pairs one student's next class with the other's parking
    // time, and leaves a Save button holding a form belonging to whoever was
    // signed in a moment ago. A remount throws all of it away at once, which
    // is the right answer when the person changed.
    <div
      key={session.kind === 'account' ? session.userId : session.kind}
      className="min-h-screen bg-white text-ink md:flex md:items-start"
    >
      {/* The nav is already the first thing in the DOM, so the one worth having
          jumps past it. A button rather than an href, because an anchor leaves
          its target in the address bar and the router then rewrites the hash
          back, which canceled the focus jump the link exists for. */}
      <button
        type="button"
        onClick={() => document.getElementById('content')?.focus()}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30
                   focus:rounded-md focus:bg-titan focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </button>

      <Sidebar active={view} onSelect={setView} />

      <div className="flex min-w-0 flex-1 flex-col md:min-h-screen">
        <TopBar
          onOpenProfile={() => setView('profile')}
          // Signing out of the profile and pressing View demo used to land
          // straight back on the profile, so this sends you to the dashboard.
          // The screen you left is still in the history, so Back can reach it.
          onSignOut={() => {
            setView('home')
            if (session.kind === 'demo') {
              // Leaving the demo, which is a different thing from signing
              // out: it must not end a session that belongs to whoever is
              // signed in, possibly in another tab of this same browser.
              void leaveDemo()
              // and the next person gets the sample student back, not the
              // last visitor's edits
              void resetDemoData()
              return
            }
            // A real account's edits are in the database and are meant to
            // still be there next time, so there is nothing to put back.
            void signOut()
          }}
        />

        <div className="flex flex-1 items-stretch">
          <main id="content" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-12 md:pt-7">
            <div className="mx-auto max-w-5xl">
              {view === 'home' && <Dashboard onOpen={setView} />}
              {view === 'parking' && <ParkingView />}
              {view === 'spots' && <SpotsView />}
              {view === 'clubs' && <ClubsView />}
              {view === 'events' && <EventsView />}
              {view === 'profile' && <ProfileView />}
            </div>
          </main>

          {withRail && <RightRail onOpen={setView} />}
        </div>
      </div>
    </div>
  )
}
