import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 22, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconBarbell = (p: P) => (
  <Svg {...p}>
    <path d="M3 12h2m14 0h2M7 12h10" />
    <rect x="5" y="7" width="2.5" height="10" rx="1" />
    <rect x="16.5" y="7" width="2.5" height="10" rx="1" />
    <rect x="2.5" y="9" width="2" height="6" rx="0.8" />
    <rect x="19.5" y="9" width="2" height="6" rx="0.8" />
  </Svg>
)

export const IconClipboard = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2.5" />
    <path d="M9 4.5V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5v1" />
    <path d="M8.5 10h7M8.5 14h7M8.5 18h4" />
  </Svg>
)

export const IconDumbbell = (p: P) => (
  <Svg {...p}>
    <path d="m9.5 14.5 5-5" />
    <rect x="4.6" y="11.9" width="3.4" height="7.5" rx="1.2" transform="rotate(-45 6.3 15.65)" />
    <rect x="16" y="4.6" width="3.4" height="7.5" rx="1.2" transform="rotate(-45 17.7 8.35)" />
    <path d="m3.5 17.5 3 3M17.5 3.5l3 3" />
  </Svg>
)

export const IconApple = (p: P) => (
  <Svg {...p}>
    <path d="M12 7c-1-2.5-4.5-3-6.3-1C3.5 8.4 4 13.5 6.5 17c1.6 2.2 3.3 3.6 5.5 2.4 2.2 1.2 3.9-.2 5.5-2.4C20 13.5 20.5 8.4 18.3 6 16.5 4 13 4.5 12 7Z" />
    <path d="M12 7c0-2 1-3.5 3-4.5" />
  </Svg>
)

export const IconTrendingUp = (p: P) => (
  <Svg {...p}>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Svg>
)

export const IconGear = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.4m0 13.6v2.4M4.9 4.9l1.7 1.7m10.8 10.8 1.7 1.7M2.8 12h2.4m13.6 0h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
  </Svg>
)

export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
)

export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
  </Svg>
)

export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </Svg>
)

export const IconCamera = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1l1.2-1.8A1.5 1.5 0 0 1 10 3.5h4a1.5 1.5 0 0 1 1.3.7L16.5 6h1A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
    <circle cx="12" cy="12.5" r="3.2" />
  </Svg>
)

export const IconDice = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="15" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2.5" />
    <path d="M4 9.5h16M8.5 3v4M15.5 3v4" />
  </Svg>
)

export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10-6.5-10-6.5Z" />
  </Svg>
)

export const IconStar = (p: P & { filled?: boolean }) => (
  <Svg {...p} fill={p.filled ? 'currentColor' : 'none'}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9L12 3.5Z" />
  </Svg>
)

export const IconTrophy = (p: P) => (
  <Svg {...p}>
    <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
    <path d="M8 5H5a3 3 0 0 0 3 4.5M16 5h3a3 3 0 0 1-3 4.5" />
    <path d="M12 14v3m-3.5 3.5h7M10 20.5c0-1.6.9-2.5 2-2.5s2 .9 2 2.5" />
  </Svg>
)

export const IconScale = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <path d="M8.5 9.5a5 5 0 0 1 7 0l-1.8 2a2.5 2.5 0 0 0-3.4 0l-1.8-2Z" />
  </Svg>
)

export const IconFlame = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5c.4 2.6 1.7 4 3.4 5.7A6.7 6.7 0 0 1 17.5 14a5.5 5.5 0 0 1-11 0c0-1.5.5-2.8 1.4-3.9.5 1 1 1.5 1.8 2 0-2.7.7-6 2.3-8.6Z" />
  </Svg>
)

export const IconTimer = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="13.5" r="7" />
    <path d="M12 10v3.8l2.5 1.7M10 2.5h4" />
  </Svg>
)

export const IconPlates = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12h19" />
    <rect x="5.4" y="6.5" width="2.6" height="11" rx="1" />
    <rect x="9" y="8.5" width="2.2" height="7" rx="1" />
    <rect x="12.8" y="8.5" width="2.2" height="7" rx="1" />
    <rect x="16" y="6.5" width="2.6" height="11" rx="1" />
  </Svg>
)

export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m15.8 15.8 4.7 4.7" />
  </Svg>
)

export const IconBolt = (p: P) => (
  <Svg {...p}>
    <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" />
  </Svg>
)

export const IconSwap = (p: P) => (
  <Svg {...p}>
    <path d="M7 4 3.5 7.5 7 11M3.5 7.5h13M17 13l3.5 3.5L17 20m3.5-3.5h-13" />
  </Svg>
)

export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M12 21.5s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10.2" r="2.3" />
  </Svg>
)

export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
    <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" />
  </Svg>
)
