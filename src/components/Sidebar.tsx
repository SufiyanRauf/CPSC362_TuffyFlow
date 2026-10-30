import type { View } from '../types'
import {
  CalendarIcon, CarIcon, DeskIcon, HomeIcon, UserIcon, UsersIcon, type IconProps,
} from './icons'

type SidebarProps = {
  active: View
  onSelect: (view: View) => void
}

type Item = {
  id: View
  label: string
  short: string
  Icon: (props: IconProps) => React.ReactElement
}

// Six flat items read as a list of words. Grouping them says what the app is
// for: the first two are how you get to class and where you wait out the gap
// afterwards, the next two are what else is on.
const groups: { heading: string | null; items: Item[] }[] = [
  {
    heading: null,
    items: [{ id: 'home', label: 'Dashboard', short: 'Home', Icon: HomeIcon }],
  },
  {
    heading: 'Around class',
    items: [
      { id: 'parking', label: 'Parking', short: 'Parking', Icon: CarIcon },
      { id: 'spots', label: 'Spots', short: 'Spots', Icon: DeskIcon },
    ],
  },
  {
    heading: 'Campus life',
    items: [
      { id: 'clubs', label: 'Clubs', short: 'Clubs', Icon: UsersIcon },
      { id: 'events', label: 'Events', short: 'Events', Icon: CalendarIcon },
    ],
  },
  {
    heading: 'You',
    items: [{ id: 'profile', label: 'Profile', short: 'Profile', Icon: UserIcon }],
  },
]

// One element, two shapes. On a phone it is a bar across the bottom, which is
// where a thumb already is; from md up it is the navy rail. The group wrappers
// collapse with `contents` on the phone so the six buttons still sit in one row.
export default function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <nav
      aria-label="Main"
      className="sidebar fixed inset-x-0 bottom-0 z-20 flex border-t border-rule bg-white pb-1
                 md:sticky md:inset-x-auto md:bottom-auto md:top-0 md:z-0 md:block md:h-screen
                 md:w-60 md:shrink-0 md:overflow-y-auto md:border-t-0 md:bg-titan md:pb-0"
    >
      <div className="hidden items-center gap-2.5 px-5 py-5 md:flex">
        {/* hidden from readers because the full name is right next to it, and
            without this one hears "TF Tuffy Flow Cal State Fullerton" */}
        <span aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-flame text-sm font-bold text-titan">
          TF
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold uppercase tracking-[0.13em] text-white">
            Tuffy Flow
          </span>
          <span className="text-[0.7rem] text-titan-200">Cal State Fullerton</span>
        </span>
      </div>

      {groups.map((group) => (
        <div key={group.heading ?? 'top'} className="contents md:block">
          {/* The same size and letter spacing as every other uppercase label
              in the app, which the cards and the parking screen already share.
              This one used to be a notch smaller and a notch wider for no
              reason anybody could point at. */}
          {group.heading && (
            <p className="hidden px-5 pb-1.5 pt-5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-titan-200 md:block">
              {group.heading}
            </p>
          )}

          {group.items.map((item) => {
            const current = item.id === active
            const Icon = item.Icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={current ? 'page' : undefined}
                className={
                  'relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 ' +
                  'px-1 text-xs md:min-h-0 md:w-full md:flex-row md:justify-start md:gap-3 ' +
                  'md:px-5 md:py-2.5 md:text-sm ' +
                  (current
                    ? 'font-semibold text-titan md:bg-white/10 md:font-medium md:text-white'
                    : 'text-ink-soft md:text-titan-200 md:hover:bg-white/5 md:hover:text-white')
                }
              >
                {current && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 top-0 h-1 rounded-full bg-flame-ink
                               md:inset-x-auto md:left-0 md:top-0 md:h-full md:w-1 md:bg-flame"
                  />
                )}
                <Icon className="h-5 w-5 md:h-[1.1rem] md:w-[1.1rem]" />
                {/* at 200% text zoom six words no longer fit, so let them clip rather
                    than push the bar off the screen */}
                <span className="w-full truncate text-center md:hidden">{item.short}</span>
                <span className="hidden md:inline">{item.label}</span>
              </button>
            )
          })}
        </div>
      ))}

      <p className="mt-6 hidden border-t border-white/10 px-5 pb-6 pt-4 text-[0.7rem] leading-relaxed text-titan-200 md:block">
        Fall 2026 · CPSC 362
      </p>
    </nav>
  )
}
