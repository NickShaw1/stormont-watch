'use client'

import { useId, useState, type CSSProperties, type KeyboardEvent } from 'react'
import m from '@/app/assembly/mlas/[id]/mlaDetail.module.css'
import styles from './partyDetail.module.css'

export type LineItem = {
  key: string
  label: string
  tick?: string
  value: number | null
  benchmark: number | null
}

// Monotone cubic through the points, so the curve is smooth and never overshoots the data.
function smooth(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x)
    slope.push((pts[i + 1].y - pts[i].y) / dx[i])
  }
  const t: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i++) t.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2)
  t.push(slope[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / slope[i]
    const b = t[i + 1] / slope[i]
    const h = Math.hypot(a, b)
    if (h > 3) { t[i] = (3 * a / h) * slope[i]; t[i + 1] = (3 * b / h) * slope[i] }
  }
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const c = dx[i] / 3
    d += ` C${(pts[i].x + c).toFixed(2)} ${(pts[i].y + t[i] * c).toFixed(2)} ${(pts[i + 1].x - c).toFixed(2)} ${(pts[i + 1].y - t[i + 1] * c).toFixed(2)} ${pts[i + 1].x.toFixed(2)} ${pts[i + 1].y.toFixed(2)}`
  }
  return d
}

// A line chart with a dashed benchmark (no chart library). Pointer users hover or tap; keyboard users focus
// the chart and use the arrow keys; screen-reader users get the same values in a hidden table.
export default function LineChart({ items, colour, ariaLabel, seriesLabel, benchmarkLabel, unit = '%', domain = 'percent', emptyLabel = 'No divisions', thinLabels = false }: {
  items: LineItem[]
  colour: string
  ariaLabel: string
  seriesLabel: string
  benchmarkLabel: string
  unit?: string
  domain?: 'percent' | 'count'
  emptyLabel?: string
  thinLabels?: boolean
}) {
  const [active, setActive] = useState<number | null>(null)
  const gradId = useId().replace(/:/g, '')
  const n = items.length

  const all = items.flatMap((it) => [it.value, it.benchmark].filter((v): v is number => v !== null))
  const peak = Math.max(...all)
  const step = peak <= 20 ? 5 : peak <= 60 ? 10 : 20
  const lo = domain === 'count' ? 0 : Math.max(0, Math.floor((Math.min(...all) - 4) / 10) * 10)
  const hi = domain === 'count' ? Math.ceil((peak * 1.05) / (2 * step)) * 2 * step : 100
  const pct = (v: number) => `${Math.round(v)}${unit}`
  const mid = (lo + hi) / 2
  const xOf = (i: number) => ((i + 0.5) / n) * 100
  const yOf = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100

  type Pt = { i: number; x: number; y: number }
  // The line breaks at every month with no divisions, so it never implies a figure for a month without one.
  const runsOf = (get: (it: LineItem) => number | null) => {
    const runs: Pt[][] = []
    let run: Pt[] = []
    let empty = 0
    items.forEach((it, i) => {
      const v = get(it)
      if (v === null) { empty += 1; return }
      if (run.length && empty >= 1) { runs.push(run); run = [] }
      empty = 0
      run.push({ i, x: xOf(i), y: yOf(v) })
    })
    if (run.length) runs.push(run)
    return runs
  }
  const partyRuns = runsOf((it) => it.value)
  const benchRuns = runsOf((it) => it.benchmark)
  const partyPath = partyRuns.map(smooth).join(' ')
  const benchPath = benchRuns.map(smooth).join(' ')
  const areaPath = partyRuns.filter((r) => r.length > 1).map((r) => `${smooth(r)} L${r[r.length - 1].x.toFixed(2)} 100 L${r[0].x.toFixed(2)} 100 Z`).join(' ')
  const singles = partyRuns.filter((r) => r.length === 1).map((r) => r[0])
  const benchSingles = benchRuns.filter((r) => r.length === 1).map((r) => r[0])

  const gaps: { start: number; len: number }[] = []
  for (let i = 0; i < n; ) {
    if (items[i].value === null && items[i].benchmark === null) {
      let j = i
      while (j < n && items[j].value === null && items[j].benchmark === null) j++
      gaps.push({ start: i, len: j - i })
      i = j
    } else i++
  }

  const present = items.map((it, i) => ({ v: it.value, i })).filter((p): p is { v: number; i: number } => p.v !== null)
  const best = present.reduce((b, p) => (p.v > b.v ? p : b), present[0]).i
  const worst = present.reduce((b, p) => (p.v < b.v ? p : b), present[0]).i
  const last = n - 1
  const lastPresent = present[present.length - 1].i
  const labelled: { i: number; where: 'above' | 'below' | 'end' }[] = [{ i: lastPresent, where: 'end' }]
  const clear = (i: number) => !thinLabels || Math.abs(i - lastPresent) > 5
  if (best !== lastPresent && clear(best)) labelled.push({ i: best, where: 'above' })
  if (worst !== lastPresent && worst !== best && clear(worst)) labelled.push({ i: worst, where: 'below' })

  for (const l of labelled) {
    if (l.where === 'below' && yOf(items[l.i].value as number) > 85) l.where = 'above'
  }
  const current = active === null ? null : items[active]
  const px = active === null ? 0 : xOf(active)
  const tipPos = px <= 50 ? { left: `calc(${px}% + 14px)` } : { right: `calc(${100 - px}% + 14px)` }
  const diff = current && current.value !== null && current.benchmark !== null ? current.value - current.benchmark : null

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
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
      className={styles.lineWrap}
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
        <thead><tr><th scope="col">Month</th><th scope="col">{seriesLabel}</th><th scope="col">{benchmarkLabel}</th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.key}><th scope="row">{it.label}</th><td>{it.value === null ? emptyLabel : `${it.value}${unit}`}</td><td>{it.benchmark === null ? emptyLabel : `${it.benchmark}${unit}`}</td></tr>
          ))}
        </tbody>
      </table>

      <ul className={styles.lineLegend} aria-hidden="true">
        <li><span className={styles.legendLine} />{seriesLabel}</li>
        <li><span className={`${styles.legendLine} ${styles.legendDash}`} />{benchmarkLabel}</li>
        <li><span className={styles.legendGap} />{emptyLabel}</li>
      </ul>

      <div className={styles.lineBody} aria-hidden="true">
        <div className={styles.lineAxis}>
          {[hi, mid, lo].map((v) => (
            <span key={v} style={{ top: `${yOf(v)}%` }}>{v}{unit}</span>
          ))}
        </div>
        <div className={styles.lineArea}>
          <div className={styles.lineCanvas}>
            {[hi, mid, lo].map((v) => (
              <span key={v} className={styles.lineGrid} style={{ top: `${yOf(v)}%` }} />
            ))}
            <svg className={styles.lineSvg} viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--series)', stopOpacity: 0.26 }} />
                  <stop offset="1" style={{ stopColor: 'var(--series)', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <path className={styles.lineFill} d={areaPath} fill={`url(#${gradId})`} />
              {benchPath && <path className={styles.lineBench} d={benchPath} />}
              <path className={styles.lineMain} d={partyPath} />
            </svg>

            {gaps.map((g) => (
              <span key={g.start} className={styles.lineGap} style={{ left: `${(g.start / n) * 100}%`, width: `${(g.len / n) * 100}%` }}>
                {g.len >= 3 && <span>{emptyLabel}</span>}
              </span>
            ))}

            {singles.map((p) => (
              <span key={`s${p.i}`} className={`${styles.lineDot} ${styles.lineDotSingle}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
            ))}
            {benchSingles.map((p) => (
              <span key={`b${p.i}`} className={styles.lineDotBench} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
            ))}

            {labelled.map(({ i, where }) => (
              <span key={i}>
                <span className={`${styles.lineDot}${where === 'end' ? ` ${styles.lineDotLatest}` : ''}`} style={{ left: `${xOf(i)}%`, top: `${yOf(items[i].value as number)}%` }} />
                <span className={styles.lineLabel} data-where={where} data-near={where !== 'end' && Math.abs(i - lastPresent) <= 5 ? '' : undefined} style={{ left: `${xOf(i)}%`, top: `${yOf(items[i].value as number)}%` }}>{pct(items[i].value as number)}</span>
              </span>
            ))}

            {current && (
              <>
                <span className={styles.lineCross} style={{ left: `${px}%` }} />
                {current.benchmark !== null && <span className={styles.lineDotBench} style={{ left: `${px}%`, top: `${yOf(current.benchmark)}%` }} />}
                {current.value !== null && <span className={styles.lineDot} style={{ left: `${px}%`, top: `${yOf(current.value)}%` }} />}
              </>
            )}

            <div className={styles.lineHits}>
              {items.map((it, i) => (
                <div
                  key={it.key}
                  className={styles.lineHit}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive((a) => (a === i ? null : i))}
                />
              ))}
            </div>

            {current && (
              <span className={m.chartTip} style={tipPos}>
                <span className={m.tipHead}><span>{current.label}</span></span>
                <span className={m.tipRow}><i style={{ background: colour }} />{seriesLabel}<b>{current.value === null ? emptyLabel : `${current.value}${unit}`}</b></span>
                {current.benchmark !== null && (
                  <span className={m.tipRow}><i className={styles.tipDash} />{benchmarkLabel}<b>{current.benchmark}{unit}</b></span>
                )}
                {diff !== null && (
                  <span className={m.tipRow}>Difference<b>{diff >= 0 ? '+' : '−'}{Math.abs(diff).toFixed(1)}{domain === 'percent' ? ' percentage points' : ''}</b></span>
                )}
              </span>
            )}
          </div>

          <div className={styles.lineTicks}>
            {items.map((it) => (
              <span key={it.key}>{it.tick ?? ''}</span>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {current ? (current.value === null ? `${current.label}: ${emptyLabel.toLowerCase()}` : `${current.label}: ${seriesLabel} ${current.value}${unit}${current.benchmark !== null ? `, ${benchmarkLabel} ${current.benchmark}${unit}` : ''}`) : ''}
      </span>
    </div>
  )
}
