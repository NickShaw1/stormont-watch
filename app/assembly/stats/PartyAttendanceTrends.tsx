'use client'

import { useState } from 'react'
import { partyBorderColor, abbreviateParty } from '@/lib/format'
import styles from './statsKit.module.css'

interface TrendPoint { party: string; month: string; attendancePct: number; memberCount: number }

const MIN_MLAS = 3

export default function PartyAttendanceTrends({ data }: { data: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const maxMembers: Record<string, number> = {}
  for (const d of data) maxMembers[d.party] = Math.max(maxMembers[d.party] ?? 0, d.memberCount)
  const parties = [...new Set(data.map((d) => d.party))].filter((p) => (maxMembers[p] ?? 0) > MIN_MLAS)
  const months = [...new Set(data.map((d) => d.month))]
  const byParty: Record<string, Record<string, number>> = {}
  for (const d of data) (byParty[d.party] ??= {})[d.month] = d.attendancePct

  if (months.length < 2 || parties.length === 0) return null

  const n = months.length
  const x = (i: number) => Math.round((i / (n - 1)) * 10000) / 100
  const y = (v: number) => Math.round((100 - Math.min(100, Math.max(0, v))) * 100) / 100

  const series = parties.map((party) => {
    const segs: string[] = []
    let cur = ''
    months.forEach((m, i) => {
      const v = byParty[party]?.[m]
      if (v === undefined) return
      cur += `${cur ? 'L' : 'M'}${x(i)},${y(v)} `
    })
    if (cur) segs.push(cur.trim())
    return { party, color: partyBorderColor(party), d: segs[0] ?? '' }
  })

  const lastMonth = [...months].reverse().find((m) => parties.some((p) => byParty[p]?.[m] !== undefined))
  const latest = lastMonth
    ? parties.map((p) => ({ party: p, pct: byParty[p]?.[lastMonth] })).filter((s): s is { party: string; pct: number } => s.pct !== undefined).sort((a, b) => b.pct - a.pct)
    : []

  const shown = hover !== null
    ? parties.map((p) => ({ party: p, pct: byParty[p]?.[months[hover]] })).filter((s): s is { party: string; pct: number } => s.pct !== undefined).sort((a, b) => b.pct - a.pct)
    : []
  const clamp = (v: number) => Math.min(80, Math.max(20, v))

  const summary = `Monthly division attendance for ${parties.map(abbreviateParty).join(', ')}.${latest.length > 1 ? ` In ${lastMonth}, ${abbreviateParty(latest[0].party)} was highest at ${latest[0].pct}% and ${abbreviateParty(latest[latest.length - 1].party)} lowest at ${latest[latest.length - 1].pct}%.` : ''}`

  return (
    <div>
      <div className={styles.line} role="img" aria-label={summary}>
        <div className={styles.linePlot} style={{ height: 260 }} onMouseLeave={() => setHover(null)}>
          {[0, 50, 100].map((g) => (
            <div key={g} className={styles.lineGrid} style={{ top: `${100 - g}%` }}><span>{g}%</span></div>
          ))}
          <svg className={styles.lineSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {series.map((s) => <path key={s.party} className={styles.lineStroke} style={{ stroke: s.color, strokeWidth: 2 }} d={s.d} />)}
          </svg>
          {months.map((m, i) => (
            <div key={m} className={styles.lineHit} style={{ left: `${x(i) - 50 / (n - 1)}%`, width: `${100 / (n - 1)}%` }} onMouseEnter={() => setHover(i)} />
          ))}
          {hover !== null && shown.length > 0 && (
            <div className={styles.colsTip} style={{ left: `${clamp(x(hover))}%`, top: 4, transform: 'translateX(-50%)' }} aria-hidden="true">
              <b>{months[hover]}</b>
              {shown.map((s) => <span key={s.party}>{abbreviateParty(s.party)}: {s.pct}%</span>)}
            </div>
          )}
        </div>
        <div className={styles.lineAxis} aria-hidden="true">
          {months.map((m, i) => (m.startsWith('Jan') || i === 0 ? <span key={m} style={{ left: `${x(i)}%` }}>{m.split(' ')[1] ?? m}</span> : null))}
        </div>
      </div>
      <ul className={styles.legend}>
        {parties.map((p) => <li key={p} style={{ ['--k' as string]: partyBorderColor(p) }}><i />{abbreviateParty(p)}</li>)}
      </ul>
    </div>
  )
}
