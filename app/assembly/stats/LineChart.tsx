'use client'

import { useState } from 'react'
import styles from './statsKit.module.css'

export interface Point {
  key: string
  label: string
  value: number | null
  low?: boolean
  detail?: string
  tick?: string
}

export default function LineChart({ data, summary, unit = '%' }: { data: Point[]; summary: string; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length < 2) return null
  const n = data.length
  const x = (i: number) => (i / (n - 1)) * 100
  const y = (v: number) => 100 - Math.min(100, Math.max(0, v))
  const pts = data.map((d, i) => (d.value === null ? null : { x: x(i), y: y(d.value) }))
  const segments: { x: number; y: number }[][] = []
  let cur: { x: number; y: number }[] = []
  for (const p of pts) {
    if (p) cur.push(p)
    else if (cur.length) { segments.push(cur); cur = [] }
  }
  if (cur.length) segments.push(cur)
  const line = (s: { x: number; y: number }[]) => s.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area = (s: { x: number; y: number }[]) => `${line(s)} L${s[s.length - 1].x},100 L${s[0].x},100 Z`
  const shown = hover !== null ? data[hover] : null
  const clamp = (v: number) => Math.min(88, Math.max(12, v))

  return (
    <div className={styles.line} role="img" aria-label={summary}>
      <div className={styles.linePlot} onMouseLeave={() => setHover(null)}>
        {[0, 50, 100].map((g) => (
          <div key={g} className={styles.lineGrid} style={{ top: `${100 - g}%` }}><span>{g}{unit}</span></div>
        ))}
        <svg className={styles.lineSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {segments.filter((s) => s.length > 1).map((s, i) => <path key={`a${i}`} className={styles.lineArea} d={area(s)} />)}
          {segments.map((s, i) => <path key={`l${i}`} className={styles.lineStroke} d={line(s)} />)}
        </svg>
        {data.map((d, i) => (d.value === null ? null : <i key={d.key} className={styles.lineDot} data-low={d.low ? '' : undefined} style={{ left: `${x(i)}%`, top: `${y(d.value)}%` }} />))}
        {data.map((d, i) => (
          <div key={d.key} className={styles.lineHit} style={{ left: `${x(i) - 50 / (n - 1)}%`, width: `${100 / (n - 1)}%` }} onMouseEnter={() => setHover(i)} />
        ))}
        {shown && (
          <div className={styles.colsTip} style={{ left: `${clamp(x(hover as number))}%`, top: shown.value === null ? '50%' : `${y(shown.value)}%`, marginTop: -12 }} aria-hidden="true">
            <b>{shown.label}</b>
            <span>{shown.value === null ? 'No comparable divisions' : `${shown.value}${unit}`}</span>
            {shown.detail && <span>{shown.detail}</span>}
          </div>
        )}
      </div>
      <div className={styles.lineAxis} aria-hidden="true">
        {data.map((d, i) => (d.tick ? <span key={d.key} style={{ left: `${x(i)}%` }}>{d.tick}</span> : null))}
      </div>
    </div>
  )
}
