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
export default function RightRail({ onOpen }: RightRailProps) {
  return (
    <aside
      aria-label="Campus right now"
      className="hidden w-80 shrink-0 self-stretch border-l border-rule bg-white px-5 py-7 xl:block"
    >
      <section>
        <SectionHeader icon={<ChartIcon className="h-4 w-4" />} title="Structures" />
        <StructureFill />
      </section>

      <section className="mt-8">
        <SectionHeader
          icon={<CalendarIcon className="h-4 w-4" />}
          title="Coming up"
          action={{ label: 'All', onClick: () => onOpen('events') }}
        />
        <UpcomingEvents />
      </section>
    </aside>
  )
}
