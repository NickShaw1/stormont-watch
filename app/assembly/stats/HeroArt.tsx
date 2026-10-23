export default function HeroArt({ className }: { className?: string }) {
  const columns = [198, 222.8, 247.6, 272.4, 297.2, 322]
  const leftWindows = [62, 82, 102, 122, 142, 162]
  const rightWindows = [350, 370, 390, 410, 430, 450]
  return (
    <svg className={className} viewBox="0 0 520 170" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="heroArtBody" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="480" y2="0">
          <stop offset="0" stopColor="var(--sw-accent-strong-solid)" />
          <stop offset="1" stopColor="var(--sw-accent-solid)" />
        </linearGradient>
      </defs>
      <ellipse cx="260" cy="156" rx="250" ry="14" fill="var(--sw-success-solid)" opacity="0.35" />
      <circle cx="260" cy="64" r="46" fill="var(--sw-accent-warm)" opacity="0.6" />
      <rect x="46" y="88" width="138" height="6" fill="url(#heroArtBody)" />
      <rect x="336" y="88" width="138" height="6" fill="url(#heroArtBody)" />
      <rect x="50" y="94" width="130" height="48" fill="url(#heroArtBody)" />
      <rect x="340" y="94" width="130" height="48" fill="url(#heroArtBody)" />
      {leftWindows.map((x) => (
        <g key={x} fill="var(--sw-bg)" opacity="0.6">
          <rect x={x} y="102" width="10" height="14" rx="2" />
          <rect x={x} y="122" width="10" height="14" rx="2" />
        </g>
      ))}
      {rightWindows.map((x) => (
        <g key={x} fill="var(--sw-bg)" opacity="0.6">
          <rect x={x} y="102" width="10" height="14" rx="2" />
          <rect x={x} y="122" width="10" height="14" rx="2" />
        </g>
      ))}
      <rect x="190" y="72" width="140" height="70" fill="url(#heroArtBody)" />
      <polygon points="180,72 260,28 340,72" fill="url(#heroArtBody)" />
      <polygon points="204,68 260,40 316,68" fill="var(--sw-bg)" opacity="0.28" />
      <rect x="180" y="72" width="160" height="8" fill="url(#heroArtBody)" />
      {columns.map((x) => (
        <rect key={x} x={x} y="80" width="8" height="62" rx="1.5" fill="var(--sw-bg)" opacity="0.85" />
      ))}
      <rect x="170" y="142" width="180" height="4" fill="url(#heroArtBody)" />
      <rect x="160" y="146" width="200" height="4" fill="url(#heroArtBody)" opacity="0.85" />
    </svg>
  )
}
