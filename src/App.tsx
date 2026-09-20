import { useState } from 'react'
import type { View } from './types'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'

export default function App() {
  const [view, setView] = useState<View>('home')

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      <Sidebar active={view} onSelect={setView} />

      <main className="flex-1 p-6">
        {view === 'home' ? (
          <Dashboard />
        ) : (
          <div className="text-slate-400">
            <h1 className="text-2xl font-semibold capitalize text-slate-100">{view}</h1>
            <p className="mt-2 text-sm">Coming in a later sprint.</p>
          </div>
        )}
      </main>
    </div>
  )
}
