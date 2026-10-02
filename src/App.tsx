import { useState } from 'react'
import type { View } from './types'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import ParkingView from './components/ParkingView'
import SpotsView from './components/SpotsView'
import ClubsView from './components/ClubsView'

export default function App() {
  const [view, setView] = useState<View>('home')

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 md:flex md:items-start">
      {/* main comes first in the DOM so that on a phone, where the nav is a bar
          across the bottom, keyboard focus starts at the heading rather than at
          the bar. From md the nav is ordered back to the left, which does mean
          it is tabbed after the content there. */}
      <main className="flex-1 p-4 pb-24 md:order-2 md:p-6 md:pb-6">
        {view === 'home' && <Dashboard onOpen={setView} />}
        {view === 'parking' && <ParkingView />}
        {view === 'spots' && <SpotsView />}
        {view === 'clubs' && <ClubsView />}
        {view === 'profile' && (
          <div className="text-slate-400">
            <h1 className="text-2xl font-semibold capitalize text-slate-100">Profile</h1>
            <p className="mt-2 text-sm">Coming in a later sprint.</p>
          </div>
        )}
      </main>

      <Sidebar active={view} onSelect={setView} />
    </div>
  )
}
