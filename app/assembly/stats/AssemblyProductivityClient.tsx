'use client'
import styles from './stats.module.css'

interface MonthRow { month: string; total_divisions: number }
interface YearRow { year: number; total: number; passed: number; pass_rate: number }

export default function AssemblyProductivityClient({
  monthData,
  yearData,
}: {
  monthData: MonthRow[]
  yearData: YearRow[]
}) {
  const parsed = monthData.map(r => ({ ...r, total_divisions: Number(r.total_divisions) }))
  const currentMonth = new Date().toISOString().slice(0, 7)
  const sittingMonths = parsed.filter(r => r.total_divisions > 0)
  const avg = sittingMonths.length > 0
    ? Math.round(sittingMonths.reduce((s, r) => s + r.total_divisions, 0) / sittingMonths.length * 10) / 10
    : 0
  const busiest = parsed.reduce((b, r) => r.total_divisions > b.total_divisions ? r : b, parsed[0])
  const busiestLabel = (() => {
    const d = new Date(busiest.month)
    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${mn[d.getMonth()]} ${d.getFullYear()}`
  })()
  const total = parsed.reduce((s, r) => s + r.total_divisions, 0)

  const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const years = [...new Set(parsed.map(r => new Date(r.month).getFullYear()))].sort()
  const maxVal = Math.max(...parsed.map(r => r.total_divisions))

  function getColor(val: number) {
    if (val === 0) return 'rgba(180,178,169,0.15)'
    const intensity = val / maxVal
    // Warm amber: #FEF3C7 (low) → #D97706 (high)
    const r = Math.round(217 + (254 - 217) * (1 - intensity))
    const g = Math.round(119 + (243 - 119) * (1 - intensity))
    const b = Math.round(6 + (199 - 6) * (1 - intensity))
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
      <div className={styles.overviewGridThree}>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Total divisions</span>
          <span className={styles.overviewValue}>{total}</span>
          <span className={styles.overviewMeta}>last 24 months</span>
        </div>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Busiest month</span>
          <span className={styles.overviewValue}>{busiest.total_divisions}</span>
          <span className={styles.overviewMeta}>{busiestLabel}</span>
        </div>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Avg per sitting month</span>
          <span className={styles.overviewValue}>{avg}</span>
          <span className={styles.overviewMeta}>excluding months with no sittings</span>
        </div>
      </div>

      <h3 className={styles.chartTitle}>Divisions per month</h3>
      <p className={styles.trendNote} style={{ marginBottom: '1rem' }}>Number of votes held each month over the last 24 months.</p>

      {/* Desktop heatmap — hidden on mobile */}
      <div className={styles.heatmapDesktop}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px', minWidth: '480px' }}>
          <thead>
            <tr>
              <th style={{ width: '36px' }} />
              {mn.map(m => (
                <th key={m} style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 400, textAlign: 'center', paddingBottom: '4px' }}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map(y => (
              <tr key={y}>
                <td style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, paddingRight: '6px', whiteSpace: 'nowrap' }}>{y}</td>
                {Array.from({ length: 12 }, (_, m) => {
                  const val = heatData[y]?.[m]
                  const isFuture = y === currentYear && m > currentMonthIdx
                  const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`
                  const isCurrentMonth = monthKey === currentMonth
                  return (
                    <td key={m} style={{
                      height: '36px',
                      borderRadius: '4px',
                      background: isFuture ? 'transparent' : val !== undefined ? getColor(val) : 'rgba(180,178,169,0.1)',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      outline: isCurrentMonth ? '2px solid var(--accent)' : 'none',
                    }}>
                      {!isFuture && val !== undefined && val > 0 ? val : ''}
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
                <th key={y} style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400, textAlign: 'center', paddingBottom: '4px' }}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, m) => (
              <tr key={m}>
                <td style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, paddingRight: '8px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {mn[m]}
                </td>
                {years.map(y => {
                  const val = heatData[y]?.[m]
                  const isFuture = y === currentYear && m > currentMonthIdx
                  const isCurrentCell = y === currentYear && m === currentMonthIdx
                  return (
                    <td key={y} style={{
                      height: '32px',
                      borderRadius: '4px',
                      background: isFuture ? 'transparent' : val !== undefined ? getColor(Number(val)) : 'rgba(180,178,169,0.1)',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: '#203F59',
                      outline: isCurrentCell ? '2px solid var(--accent)' : 'none',
                    }}>
                      {!isFuture && val !== undefined && Number(val) > 0 ? val : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.trendNote}>* Months with no colour had no Assembly sittings. The current month is outlined.</p>

      <h3 className={styles.chartTitle}>Pass rate by year</h3>
      <p className={styles.trendNote} style={{ marginBottom: '1rem' }}>Percentage of divisions that passed in each calendar year since February 2024.</p>

      <div className={styles.overviewGridThree}>
        {yearData.map((r, i) => (
          <div key={r.year} className={styles.overviewCard}>
            <span className={styles.overviewLabel}>{r.year}{i === yearData.length - 1 ? ' (year to date)' : ''}</span>
            <span className={styles.overviewValue}>{Number(r.pass_rate)}%</span>
            <span className={styles.overviewMeta}>{Number(r.passed)} of {Number(r.total)} passed</span>
          </div>
        ))}
      </div>
    </div>
  )
}
