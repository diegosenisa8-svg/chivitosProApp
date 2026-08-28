/** SVG icons for TuMenuWeb-style admin rail */
export function RailIcon({ name }: { name: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      )
    case 'marketing':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'reports':
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16" />
          <path d="M8 16V10M12 16V7M16 16v-4" />
        </svg>
      )
    case 'online':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M5 12a7 7 0 0 1 14 0" />
          <path d="M2 12a10 10 0 0 1 20 0" />
        </svg>
      )
    case 'other':
    default:
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      )
  }
}
