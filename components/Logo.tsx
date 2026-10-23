export default function Logo({ size, className, blinkClassName }: { size: number; className?: string; blinkClassName?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g className={blinkClassName}>
        <path d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </g>
    </svg>
  )
}
