'use client'

import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import m from '@/app/assembly/mlas/[id]/mlaDetail.module.css'
import styles from './partyDetail.module.css'

export type ColumnItem = {
  key: string
  label: string
  tick?: string
  value: number
  text: string
  short?: string
}

// A CSS column chart (no chart library). Pointer users hover or tap a column; keyboard users focus the
// chart and use the arrow keys; screen-reader users get the same values in a hidden table.
export default function ColumnChart({ items, max, colour, ariaLabel, valueLabel, showValues }: {
  items: ColumnItem[]
  max: number
  colour: string
  ariaLabel: string
  valueLabel: string
  showValues?: boolean
}) {
  const [active, setActive] = useState<number | null>(null)
  const pct = active === null ? 0 : ((active + 0.5) / items.length) * 100
  const pos = pct <= 50 ? { left: `calc(${pct}% + 14px)` } : { right: `calc(${100 - pct}% + 14px)` }
  const current = active === null ? null : items[active]
  const pointer = !showValues

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const last = items.length - 1
    if (e.key === 'ArrowRight') setActive((a) => (a === null ? 0 : Math.min(last, a + 1)))
    else if (e.key === 'ArrowLeft') setActive((a) => (a === null ? last : Math.max(0, a - 1)))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(last)
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  return (
    <div
      className={styles.chartPlot}
      style={{ '--series': colour } as CSSProperties}
      tabIndex={0}
      role="group"
      aria-label={`${ariaLabel}. Use the left and right arrow keys to read each value.`}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
      onMouseLeave={() => setActive(null)}
    >
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead><tr><th scope="col">Period</th><th scope="col">{valueLabel}</th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.key}><th scope="row">{it.label}</th><td>{it.text}</td></tr>
          ))}
        </tbody>
      </table>
      <div className={styles.chartCols} data-density={items.length > 16 ? 'tight' : items.length > 8 ? 'alt' : undefined} aria-hidden="true">
        {items.map((it, i) => (
          <div
            key={it.key}
            className={styles.chartCol}
            data-hover={pointer && active === i ? '' : undefined}
            onMouseEnter={pointer ? () => setActive(i) : undefined}
            onClick={pointer ? () => setActive((a) => (a === i ? null : i)) : undefined}
          >
            <span className={styles.chartBars}>
              <span
                className={styles.chartBar}
                data-value={showValues ? it.short ?? '' : undefined}
                style={{ height: `${max > 0 ? Math.max(0, Math.min(100, (it.value / max) * 100)) : 0}%` }}
              />
            </span>
            <span className={styles.chartTick}>{it.tick ?? ''}</span>
          </div>
        ))}
      </div>
      {pointer && current && (
        <span className={m.chartTip} style={pos} aria-hidden="true">
          <span className={m.tipHead}><span>{current.label}</span></span>
          <span className={m.tipRow}><i style={{ background: colour }} />{valueLabel}<b>{current.text}</b></span>
        </span>
      )}
      <span className="sr-only" aria-live="polite">{current ? `${current.label}: ${current.text}` : ''}</span>
    </div>
  )
}
