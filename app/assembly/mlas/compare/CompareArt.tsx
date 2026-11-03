export default function CompareArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 520 170" aria-hidden="true" focusable="false">
      <ellipse cx="260" cy="157" rx="232" ry="12" fill="var(--sw-success-solid)" opacity="0.35" />
      <circle cx="260" cy="76" r="50" fill="var(--sw-accent-warm)" opacity="0.55" />
      <g transform="rotate(-5 155 84)">
        <rect x="70" y="22" width="170" height="124" rx="22" fill="var(--sw-accent-strong-solid)" />
        <circle cx="155" cy="64" r="21" fill="#ffffff" opacity="0.92" />
        <path d="M112 146 C112 98 198 98 198 146 Z" fill="#ffffff" opacity="0.92" />
      </g>
      <g transform="rotate(5 365 84)">
        <rect x="280" y="22" width="170" height="124" rx="22" fill="#ec4899" />
        <circle cx="365" cy="64" r="21" fill="#ffffff" opacity="0.92" />
        <path d="M322 146 C322 98 408 98 408 146 Z" fill="#ffffff" opacity="0.92" />
      </g>
      <circle cx="260" cy="84" r="29" fill="var(--tile-bg)" stroke="var(--sw-border)" strokeWidth="1.5" />
      <text x="260" y="91" textAnchor="middle" fontSize="19" fontWeight="700" letterSpacing="0.04em" fill="var(--sw-text-primary)" fontFamily="inherit">VS</text>
    </svg>
  )
}
