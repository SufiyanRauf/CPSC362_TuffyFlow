import type { View } from '../types'
import SectionHeader from './SectionHeader'
import StructureFill from './StructureFill'
import UpcomingEvents from './UpcomingEvents'
import { CalendarIcon, ChartIcon } from './icons'

type RightRailProps = {
  onOpen: (view: View) => void
}

// Only wide screens get this. Below xl the same two blocks would squeeze the
// main column down to nothing, so they are left off rather than stacked at the
// bottom where nobody scrolls to them.
//
// Whether there is room is decided by App, with useWideScreen, so this does
// not mount at all on a narrow screen. It used to hide itself with
// `hidden xl:block`, which takes it off the screen but still runs
// everything inside it.
export default function RightRail({ onOpen }: RightRailProps) {
  return (
    <aside
      // not "campus right now": nothing in here is a live reading. The strip
      // below says in its own caption that it is what these usually look like.
      aria-label="Campus at a glance"
      className="w-80 shrink-0 self-stretch border-l border-rule bg-white px-5 py-7"
    >
      <section>
        {/* Two of the six rows under this are S8 and S10, which are surface
            lots by the stadium and not structures at all, so the old heading
            was wrong for a third of what it sat over. */}
        <SectionHeader icon={<ChartIcon className="h-4 w-4" />} title="How full the lots are" />
        <StructureFill />
      </section>

      <section className="mt-8">
        <SectionHeader
          icon={<CalendarIcon className="h-4 w-4" />}
          title="Coming up"
          // "All" on its own was the entire name of this button. The header
          // renders its action beside the heading rather than inside it, so
          // nothing ties the two together and a reader moving through the
          // controls hears one word. Naming the thing it opens is the fix, and
          // it matches the wording on the cards.
          action={{ label: 'All events', onClick: () => onOpen('events') }}
        />
        <UpcomingEvents />
      </section>
    </aside>
  )
}
