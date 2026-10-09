import type { ReactNode } from 'react'
import { ChevronRightIcon } from './icons'

type SectionHeaderProps = {
  icon: ReactNode
  title: string
  note?: string
  action?: { label: string; onClick: () => void }
}

export default function SectionHeader({ icon, title, note, action }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-titan">
          <span className="text-flame-ink">{icon}</span>
          {title}
        </h2>
        {note && <p className="mt-0.5 text-xs text-ink-faint">{note}</p>}
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-sm
                     font-medium text-titan hover:underline"
        >
          {action.label}
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
