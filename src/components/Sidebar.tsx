import type { View } from '../App'

type SidebarProps = {
  active: View
  onSelect: (view: View) => void
}

const views: { id: View; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'parking', label: 'Parking' },
  { id: 'spots', label: 'Spots' },
  { id: 'clubs', label: 'Clubs' },
  { id: 'profile', label: 'Profile' },
]

export default function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <nav className="w-48 shrink-0 bg-slate-950 p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-bold grid place-items-center">
          TF
        </div>
        <span className="font-semibold">Tuffy Flow</span>
      </div>

      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onSelect(view.id)}
          className={
            'text-left px-3 py-2 rounded-md text-sm ' +
            (view.id === active
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900')
          }
        >
          {view.label}
        </button>
      ))}
    </nav>
  )
}
