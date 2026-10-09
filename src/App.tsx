import { useEffect, useRef, useState } from 'react'
import { useHashRoute } from './lib/useHashRoute'
import { resetDemoData } from './lib/campusData'
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
  // Session only on purpose. There is no auth yet, so there is nothing to
  // remember, and a reload should land back on the login screen.
  const [entered, setEntered] = useState(false)

  // React unmounts whichever side had focus, which drops it on the body. Hand
  // it across instead, both ways: in to the content, which already takes focus
  // for the skip link, and back out to the button that gets you in again.
  // It compares against the last value rather than counting renders. A
  // first-paint flag got burned by StrictMode's second run of the effect,
  // which then stole focus the moment the page loaded.
  const was = useRef(entered)
  useEffect(() => {
    if (was.current === entered) return
    was.current = entered
    document.getElementById(entered ? 'content' : 'login-demo')?.focus()
  }, [entered])

  if (!entered) return <LoginView onDemo={() => setEntered(true)} />

  // the rail is live campus numbers, so it earns its space next to the
  // dashboard and the lots and would just be clutter on the other four
  const withRail = view === 'home' || view === 'parking'

  return (
    <div className="min-h-screen bg-white text-ink md:flex md:items-start">
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
          onSignOut={() => { setEntered(false); setView('home'); void resetDemoData() }}
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
