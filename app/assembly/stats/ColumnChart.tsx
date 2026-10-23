'use client'

import { useState } from 'react'
import styles from './statsKit.module.css'

export interface Column {
  key: string
  label: string
  value: number
  inner?: number
  tick?: string
}

export default function ColumnChart({ data, unit, summary }: { data: Column[]; unit: string; summary: string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length === 0) return null
  const max = Math.max(1, ...data.map((d) => d.value))
  const peak = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0)
  const pos = (i: number) => ((i + 0.5) / data.length) * 100
  const shown = hover !== null ? data[hover] : null
  const clamp = (n: number) => Math.min(92, Math.max(8, n))

  return (
    <div className={styles.cols} role="img" aria-label={summary}>
      <div className={styles.colsPlot} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div
            key={d.key}
            className={styles.colsBar}
            data-peak={i === peak && hover === null ? '' : undefined}
            onMouseEnter={() => setHover(i)}
          >
            <i style={{ height: `${Math.max(1, (d.value / max) * 100)}%` }}>{d.inner !== undefined && d.value > 0 && <u style={{ height: `${(d.inner / d.value) * 100}%` }} />}</i>
          </div>
        ))}
        {shown && (
          <div className={styles.colsTip} style={{ left: `${clamp(pos(hover as number))}%` }} aria-hidden="true">
            <b>{shown.label}</b>
            <span>{shown.value} {unit}</span>
            {shown.inner !== undefined && <span>{shown.inner} agreed</span>}
          </div>
        )}
      </div>
      <div className={styles.colsAxis} aria-hidden="true">
        {data.map((d, i) => (d.tick ? <span key={d.key} style={{ left: `${pos(i)}%` }}>{d.tick}</span> : null))}
      </div>
    </div>
  )
}
