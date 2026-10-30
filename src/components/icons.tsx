import type { ReactNode } from 'react'

// Hand drawn so the nav, the cards and the tables all pull from one place and
// every icon inherits color and size from whatever it sits in. Not worth a
// dependency for a dozen shapes.
export type IconProps = { className?: string }

// The viewBox is 20 wide and most of these render at h-4 w-4, so whatever
// strokeWidth says gets scaled down to about four fifths of it. 1.6 came out as
// 1.28px on screen, which holds up on a laptop and vanishes on the projector in
// the lab, so it is 1.8 instead. Nothing about the layout changes.
function Svg({ children, className = 'h-4 w-4' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
    >
      {children}
    </svg>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.6" y="2.6" width="6.2" height="6.2" rx="1.4" />
      <rect x="11.2" y="2.6" width="6.2" height="6.2" rx="1.4" />
      <rect x="2.6" y="11.2" width="6.2" height="6.2" rx="1.4" />
      <rect x="11.2" y="11.2" width="6.2" height="6.2" rx="1.4" />
    </Svg>
  )
}

export function CarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.4 13V9.7a1 1 0 0 1 .24-.65l2.1-2.45a1 1 0 0 1 .76-.35h7a1 1 0 0 1 .76.35l2.1 2.45a1 1 0 0 1 .24.65V13" />
      <path d="M2.8 13h14.4M4.6 9.6h10.8" />
      <circle cx="6.4" cy="14.5" r="1.3" />
      <circle cx="13.6" cy="14.5" r="1.3" />
    </Svg>
  )
}

export function DeskIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 5.9S8.3 4.6 4.8 4.6v9C8.3 13.6 10 15 10 15s1.7-1.4 5.2-1.4v-9C11.7 4.6 10 5.9 10 5.9Z" />
      <path d="M10 5.9V15" />
    </Svg>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="7.8" cy="7.2" r="2.4" />
      <path d="M3.2 15.6c0-2.3 2-3.7 4.6-3.7s4.6 1.4 4.6 3.7" />
      <path d="M13.4 5.3a2.4 2.4 0 0 1 0 4.5M14.6 12.2c1.5.5 2.6 1.6 2.6 3.4" />
    </Svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.9" y="4.6" width="14.2" height="12.5" rx="1.6" />
      <path d="M2.9 8.4h14.2M6.9 3.1v2.6M13.1 3.1v2.6" />
    </Svg>
  )
}

export function UserIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="6.8" r="2.9" />
      <path d="M4.3 16.5c0-2.8 2.5-4.5 5.7-4.5s5.7 1.7 5.7 4.5" />
    </Svg>
  )
}

export function SignOutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.2 14.3v1.4a1.4 1.4 0 0 1-1.4 1.4H5.1a1.4 1.4 0 0 1-1.4-1.4V4.3a1.4 1.4 0 0 1 1.4-1.4h5.7a1.4 1.4 0 0 1 1.4 1.4v1.4" />
      <path d="M9.4 10h6.9m0 0-2.3-2.3m2.3 2.3-2.3 2.3" />
    </Svg>
  )
}

export function WalkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11.4" cy="3.5" r="1.7" />
      <path d="M10.4 7.5 7.6 10.3l1.8 2.3-1 5.1M10.4 7.5l3 1.4 1.1 2.9M10.4 7.5 6.4 8.6l-1 2.8" />
    </Svg>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="7.1" />
      <path d="M10 5.7V10l2.9 1.8" />
    </Svg>
  )
}

export function PinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 17.4s5.5-5 5.5-8.6a5.5 5.5 0 1 0-11 0c0 3.6 5.5 8.6 5.5 8.6Z" />
      <circle cx="10" cy="8.8" r="1.9" />
    </Svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="7.1" />
      <path d="M6.8 10.2 9 12.4l4-4.6" />
    </Svg>
  )
}

export function ChartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 16.6h14" />
      <path d="M5.8 16.6V9.4M10 16.6V4.8M14.2 16.6v-4.4" />
    </Svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 5.2 12.8 10 8 14.8" />
    </Svg>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 10h12.8M11.4 5l5 5-5 5" />
    </Svg>
  )
}
