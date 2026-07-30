'use client'
import { CalendarCheck, Flame, Gauge, Percent } from 'lucide-react'
import styles from './stats.module.css'
import AllPartyAttendanceChart from './AllPartyAttendanceChart'
import { useMandate } from '@/components/MandateContext'

interface MonthRow { month: string; total_divisions: number }
interface YearRow { year: number; total: number; passed: number; pass_rate: number }
interface PartyTrendRow { party: string; month: string; attendancePct: number; memberCount: number }

export default function AssemblyProductivityClient({
  monthData,
  yearData,
  sittingDays,
  partyAttendanceTrends,
}: {
  monthData: MonthRow[]
  yearData: YearRow[]
  sittingDays: number
  partyAttendanceTrends: PartyTrendRow[]
}) {
  const { mandate } = useMandate()
  const parsed = monthData.map(r => ({ ...r, total_divisions: Number(r.total_divisions) }))
  const currentMonth = new Date().toISOString().slice(0, 7)
  const sittingMonths = parsed.filter(r => r.total_divisions > 0)
  const avg = sittingMonths.length > 0
    ? Math.round(sittingMonths.reduce((s, r) => s + r.total_divisions, 0) / sittingMonths.length * 10) / 10
    : 0
  const busiest = parsed.length ? parsed.reduce((b, r) => r.total_divisions > b.total_divisions ? r : b, parsed[0]) : null
  const busiestLabel = busiest ? (() => {
    const d = new Date(busiest.month)
    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${mn[d.getMonth()]} ${d.getFullYear()}`
  })() : '-'
  const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const years = [...new Set(parsed.map(r => new Date(r.month).getFullYear()))].sort()
  const maxVal = Math.max(1, ...parsed.map(r => r.total_divisions))

  function getColor(val: number) {
    if (val === 0) return 'rgba(101,107,114,0.12)'
    const intensity = val / maxVal
    // Warm amber tint, scaling from pale to --sw-accent-warm (#e0a72a)
    const r = Math.round(224 + (250 - 224) * (1 - intensity))
    const g = Math.round(167 + (240 - 167) * (1 - intensity))
    const b = Math.round(42 + (200 - 42) * (1 - intensity))
    return `rgb(${r},${g},${b})`
  }

  const heatData: Record<number, Record<number, number>> = {}
  parsed.forEach(r => {
    const d = new Date(r.month)
    const y = d.getFullYear()
    const m = d.getMonth()
    if (!heatData[y]) heatData[y] = {}
    heatData[y][m] = r.total_divisions
  })

  const currentYear = new Date().getFullYear()
  const currentMonthIdx = new Date().getMonth()

  return (
    <div>
      <div className={styles.glanceBarThree}>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>Sitting days</span>
            <CalendarCheck className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>{sittingDays}</span>
          <span className={styles.glanceCellMeta}>since {mandate.startLabel}</span>
        </div>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>Busiest month</span>
            <Flame className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>{busiest?.total_divisions ?? 0}</span>
          <span className={styles.glanceCellMeta}>{busiestLabel}</span>
        </div>
        <div className={styles.glanceCell}>
          <div className={styles.glanceCellLabelRow}>
            <span className={styles.glanceCellLabel}>Avg per sitting month</span>
            <Gauge className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.glanceCellValue}>{avg}</span>
          <span className={styles.glanceCellMeta}>since Assembly resumed, excluding months with no sittings</span>
        </div>
      </div>

      <h3 className={styles.chartTitle}>Party Division Attendance</h3>
      <p className={styles.trendNote} style={{ marginBottom: 'var(--s-4)' }}>How each party&apos;s division attendance has tracked month by month since {mandate.startLabel}.</p>
      <AllPartyAttendanceChart data={partyAttendanceTrends} />

      <h3 className={styles.chartTitle}>Divisions per month</h3>
      <p className={styles.trendNote} style={{ marginBottom: 'var(--s-4)' }}>Number of votes held each month since {mandate.startLabel}.</p>

      {/* Desktop heatmap — hidden on mobile */}
      <div className={styles.heatmapDesktop}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px', minWidth: '480px' }}>
          <thead>
            <tr>
              <th style={{ width: '36px' }} />
              {mn.map(m => (
                <th key={m} style={{ fontSize: '10px', color: 'var(--sw-text-secondary)', fontWeight: 400, textAlign: 'center', paddingBottom: '4px' }}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map(y => (
              <tr key={y}>
                <td style={{ fontSize: '11px', color: 'var(--sw-text-secondary)', fontWeight: 500, paddingRight: '6px', whiteSpace: 'nowrap' }}>{y}</td>
                {Array.from({ length: 12 }, (_, m) => {
                  const val = heatData[y]?.[m]
                  const isFuture = y === currentYear && m > currentMonthIdx
                  const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`
                  const isCurrentMonth = monthKey === currentMonth
                  return (
                    <td key={m} style={{
                      height: '36px',
                      background: isFuture ? 'transparent' : val !== undefined ? getColor(val) : 'var(--sw-surface-subtle)',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: val ? '#1a1d21' : 'var(--sw-text-primary)',
                      outline: isCurrentMonth ? '2px solid var(--sw-accent)' : 'none',
                    }}>
                      {!isFuture && val !== undefined && (val > 0 || isCurrentMonth) ? (val ?? 0) : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile heatmap — vertical, months as rows, years as columns */}
      <div className={styles.heatmapMobile}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '3px', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '32px' }} />
              {years.map(y => (
                <th key={y} style={{ fontSize: '11px', color: 'var(--sw-text-secondary)', fontWeight: 400, textAlign: 'center', paddingBottom: '4px' }}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, m) => (
              <tr key={m}>
                <td style={{ fontSize: '11px', color: 'var(--sw-text-secondary)', fontWeight: 500, paddingRight: '8px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {mn[m]}
                </td>
                {years.map(y => {
                  const val = heatData[y]?.[m]
                  const isFuture = y === currentYear && m > currentMonthIdx
                  const isCurrentCell = y === currentYear && m === currentMonthIdx
                  return (
                    <td key={y} style={{
                      height: '32px',
                      background: isFuture ? 'transparent' : val !== undefined ? getColor(Number(val)) : 'var(--sw-surface-subtle)',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: val ? '#1a1d21' : 'var(--sw-text-primary)',
                      outline: isCurrentCell ? '2px solid var(--sw-accent)' : 'none',
                    }}>
                      {!isFuture && val !== undefined && (Number(val) > 0 || isCurrentCell) ? (val ?? 0) : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="note-card">
        <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
          <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
          <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
        </svg>
        <p>Months with no colour had no Assembly sittings. The current month is outlined.</p>
      </div>

      <h3 className={styles.chartTitle}>Pass rate by year</h3>
      <p className={styles.trendNote} style={{ marginBottom: 'var(--s-4)' }}>Percentage of divisions that passed in each calendar year since {mandate.startLabel}.</p>

      <div className={styles.glanceBarDynamic} style={{ '--glance-cols': yearData.length } as React.CSSProperties}>
        {yearData.map((r, i) => (
          <div key={r.year} className={styles.glanceCell}>
            <div className={styles.glanceCellLabelRow}>
              <span className={styles.glanceCellLabel}>{r.year}{i === yearData.length - 1 ? ' (YTD)' : ''}</span>
              <Percent className={styles.glanceCellIcon} size={19} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <span className={styles.glanceCellValue}>{Number(r.pass_rate)}%</span>
            <span className={styles.glanceCellMeta}>{Number(r.passed)} of {Number(r.total)} passed</span>
          </div>
        ))}
      </div>
    </div>
  )
}
