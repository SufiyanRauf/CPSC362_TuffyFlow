import type { View } from '../types'

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

// On a phone this is a bar across the bottom, which is where a thumb already is
// and does not cost us half the width. From md up it goes back to a column down
// the left.
export default function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-800 bg-slate-950
                 md:static md:w-48 md:shrink-0 md:flex-col md:gap-1 md:border-t-0 md:p-4"
    >
      <div className="hidden items-center gap-2 mb-6 md:flex">
        <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-bold grid place-items-center">
          TF
        </div>
        <span className="font-semibold">Tuffy Flow</span>
      </div>

      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onSelect(view.id)}
          aria-current={view.id === active ? 'page' : undefined}
          className={
            // min-h-12 keeps the tap target big enough on a phone
            'flex-1 min-h-12 px-2 text-center text-xs ' +
            'md:flex-none md:min-h-0 md:text-left md:px-3 md:py-2 md:rounded-md md:text-sm ' +
            (view.id === active
              ? 'text-amber-400 md:bg-slate-800 md:text-white'
              : 'text-slate-400 hover:text-white md:hover:bg-slate-900')
          }
        >
          {view.label}
        </button>
      ))}
    </nav>
  )
}
