'use client'

import React, { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { partyBorderColor, abbreviateParty } from '@/lib/format'
import { buildSeats, H, VIEW_TOP, VIEW_X, VIEW_W, HIT_RADIUS, SR, type HemicycleParty, type Seat } from '@/lib/hemicycle'
import { useMandate } from '@/components/MandateContext'
import styles from './AssemblyHemicycle.module.css'

interface HemicycleProps {
  parties: HemicycleParty[]
}

export default function AssemblyHemicycle({ parties }: HemicycleProps) {
  const { basePath } = useMandate()
  const router = useRouter()
  const [active, setActive] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const seats = buildSeats(parties)
  const total = parties.reduce((s, p) => s + p.mlaCount, 0)

  const slugByParty = Object.fromEntries(parties.map((p) => [p.party, p.slug]))

  // Nearest seat to the pointer, so the gaps between dots count as part of the party.
  function seatAt(clientX: number, clientY: number): Seat | null {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    const scale = VIEW_W / rect.width
    const x = VIEW_X + (clientX - rect.left) * scale
    const y = VIEW_TOP + (clientY - rect.top) * scale
    let best: Seat | null = null
    let bestDist = HIT_RADIUS
    for (const s of seats) {
      const d = Math.hypot(s.x - x, s.y - y)
      if (d < bestDist) { best = s; bestDist = d }
    }
    return best
  }

  return (
    <div className={styles.wrap}>
      <div
        className={styles.plot}
        data-hit={active !== null ? '' : undefined}
        onMouseMove={(e) => setActive(seatAt(e.clientX, e.clientY)?.party ?? null)}
        onMouseLeave={() => setActive(null)}
        onClick={(e) => {
          const seat = seatAt(e.clientX, e.clientY)
          if (seat) router.push(`${basePath}/assembly/parties/${slugByParty[seat.party]}`)
        }}
      >
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={`${VIEW_X} ${VIEW_TOP} ${VIEW_W} ${H - VIEW_TOP}`}
          width="100%"
          aria-hidden="true"
        >
          {seats.map((s, i) => (
            <circle
              key={i}
              className={styles.seat}
              cx={s.x}
              cy={s.y}
              r={SR}
              fill={s.color}
              data-dim={active !== null && active !== s.party ? '' : undefined}
            />
          ))}
        </svg>
        <div className={styles.centre} aria-hidden="true">
          <span className={styles.centreNum}>{total}</span>
          <span className={styles.centreLabel}>seats</span>
        </div>
      </div>

      <ul className={styles.legend} aria-label="Seats by party">
        {parties.map((p) => {
          const short = p.party === 'Independent' ? p.party : abbreviateParty(p.party)
          return (
            <li key={p.slug}>
              <Link
                href={`${basePath}/assembly/parties/${p.slug}`}
                className={styles.pill}
                title={p.party}
                data-active={active === p.party ? '' : undefined}
                onMouseEnter={() => setActive(p.party)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(p.party)}
                onBlur={() => setActive(null)}
              >
                <i className={styles.dot} style={{ background: partyBorderColor(p.party) }} aria-hidden="true" />
                <span>{short}</span>
                <b>{p.mlaCount}</b>
                <span className="sr-only"> seats</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
