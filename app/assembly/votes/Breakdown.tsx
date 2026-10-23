'use client'

import { useState } from 'react'
import { PieChart } from 'lucide-react'
import { useVotesFilters, type FilterDim } from './VotesFilters'
import styles from './votes.module.css'

export interface BreakdownSegment {
  key: string
  label: string
  count: number
  pct: number
  colour: string
  detail: string
  value: string
}

export interface BreakdownSet {
  id: string
  label: string
  dim: FilterDim
  total: number
  segments: BreakdownSegment[]
}

const R = 76
const C = 2 * Math.PI * R
const GAP = 3

export default function Breakdown({ sets }: { sets: BreakdownSet[] }) {
  const [setId, setSetId] = useState(sets[0]?.id ?? '')
  const [segKey, setSegKey] = useState<string | null>(null)
  const filters = useVotesFilters()
  const set = sets.find(s => s.id === setId) ?? sets[0]
  if (!set) return null
  const segments = set.segments.filter(s => s.count > 0)
  const total = segments.reduce((s, x) => s + x.count, 0)
  const active = segments.find(s => s.key === segKey) ?? segments[0]

  const choose = (s: BreakdownSegment) => {
    setSegKey(s.key)
    const wasApplied = filters.isApplied(set.dim, s.value)
    filters.toggle(set.dim, s.value)
    if (wasApplied) return
    window.setTimeout(() => {
      const el = document.getElementById('votes-list')
      if (!el) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      el.focus({ preventScroll: true })
    }, 80)
  }

  let offset = 0
  const arcs = segments.map(s => {
    const len = Math.max(0, (s.count / total) * C - (segments.length > 1 ? GAP : 0))
    const arc = { s, len, start: offset }
    offset += (s.count / total) * C
    return arc
  })

  return (
    <section className={`${styles.tile} ${styles.break}`} aria-labelledby="break-heading">
      <div className={styles.breakHead}>
        <div className={styles.breakIntro}>
          <span className={`${styles.iconTile} ${styles.tnBlue}`}><PieChart size={22} strokeWidth={2} aria-hidden="true" /></span>
          <div className={styles.breakTitles}>
            <h2 className={styles.breakTitle} id="break-heading">Division results</h2>
            <p className={styles.breakCaption} aria-live="polite">{active?.detail}</p>
          </div>
        </div>
        <div className={styles.tabs} role="group" aria-label="Break the divisions down by">
          {sets.map(s => (
            <button
              key={s.id}
              type="button"
              className={styles.tabBtn}
              aria-pressed={s.id === set.id}
              onClick={() => { setSetId(s.id); setSegKey(null) }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.breakBody} key={set.id}>
        <div className={styles.donut}>
          <svg viewBox="9 9 182 182" className={styles.donutSvg} aria-hidden="true">
            <circle cx="100" cy="100" r={R} className={styles.donutTrack} />
            {arcs.map(({ s, len, start }) => (
              <circle
                key={s.key}
                cx="100"
                cy="100"
                r={R}
                className={styles.donutArc}
                data-active={active?.key === s.key ? '' : undefined}
                style={{ stroke: s.colour, strokeDasharray: `${len} ${C - len}`, strokeDashoffset: -start }}
                transform="rotate(-90 100 100)"
                onMouseEnter={() => setSegKey(s.key)}
                onClick={() => choose(s)}
              />
            ))}
          </svg>
          {active && (
            <div className={styles.donutCentre} aria-hidden="true">
              <span className={styles.donutFigure}>{active.count}</span>
              <span className={styles.donutLabel}>{active.label}</span>
            </div>
          )}
        </div>

        <ul className={styles.rows} data-few={segments.length <= 3 ? '' : undefined} data-many={segments.length > 4 ? '' : undefined}>
          {segments.map(s => (
            <li key={s.key}>
              <button
                type="button"
                className={styles.row}
                aria-pressed={filters.isApplied(set.dim, s.value)}
                data-preview={active?.key === s.key ? '' : undefined}
                onClick={() => choose(s)}
                onMouseEnter={() => setSegKey(s.key)}
                style={{ '--k': s.colour } as React.CSSProperties}
              >
                <span className={styles.rowTop}>
                  <i className={styles.rowDot} aria-hidden="true" />
                  <span className={styles.rowName}>{s.label}</span>
                </span>
                <span className={styles.rowBottom}>
                  <span className={styles.rowPct}>{s.pct}<small>%</small></span>
                  <span className={styles.rowCount}>{s.count}<span className="sr-only"> {s.count === 1 ? 'division' : 'divisions'}</span></span>
                </span>
                <span className={styles.rowMeter} aria-hidden="true"><span style={{ width: `${s.pct}%` }} /></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
