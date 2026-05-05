'use client'
import { useEffect, useRef } from 'react'
import type { TooltipItem } from 'chart.js'
import styles from './stats.module.css'

interface Row {
  month: string
  total_divisions: number
  agreed_divisions: number
  agreement_pct: number | null
}

export default function CrossCommunityTrendsClient({ data }: { data: Row[] }) {
  const c1 = useRef<HTMLCanvasElement>(null)
  const c2 = useRef<HTMLCanvasElement>(null)
  const chart1 = useRef<{ destroy: () => void } | null>(null)
  const chart2 = useRef<{ destroy: () => void } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    import('chart.js/auto').then(({ Chart }) => {
      if (chart1.current) { chart1.current.destroy(); chart1.current = null }
      if (chart2.current) { chart2.current.destroy(); chart2.current = null }

      const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

      const labels = data.map(r => {
        const d = new Date(r.month)
        return `${mn[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
      })

      const pcts = data.map(r => r.agreement_pct)
      const totals = data.map(r => r.total_divisions)
      const agreed = data.map(r => r.agreed_divisions)
      const radii = data.map(r => r.total_divisions >= 3 ? 4 : r.total_divisions > 0 ? 2 : 0)
      const colors = data.map(r => r.total_divisions >= 3 ? '#6366F1' : r.total_divisions > 0 ? 'rgba(99,102,241,0.4)' : 'transparent')

      if (c1.current) {
        chart1.current = new Chart(c1.current, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                data: pcts,
                borderColor: '#6366F1',
                backgroundColor: 'rgba(99,102,241,0.07)',
                borderWidth: 2,
                pointRadius: radii,
                pointHoverRadius: radii.map(r => r + 2),
                pointBackgroundColor: colors,
                pointBorderColor: colors,
                fill: true,
                tension: 0.3,
                spanGaps: true,
                order: 1,
              },
            ],
          },
          options: {
            layout: { padding: { top: 15 } },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#1a2a3a',
                titleColor: '#ffffff',
                bodyColor: '#a0b8c8',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 6,
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                bodySpacing: 4,
                displayColors: false,
                callbacks: {
                  title: (items: TooltipItem<'line'>[]) => {
                    const idx = items[0].dataIndex
                    const d = new Date(data[idx].month)
                    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    return `${mn[d.getMonth()]} ${d.getFullYear()}`
                  },
                  label: (item: TooltipItem<'line'>) => {
                    const idx = item.dataIndex
                    const row = data[idx]
                    return [
                      `Both blocs voted same way: ${item.raw}%`,
                      `Divisions that month: ${row.total_divisions}`,
                      `Voted same way: ${row.agreed_divisions} of ${row.total_divisions}`,
                    ]
                  },
                },
              },
            },
            scales: {
              x: { ticks: { font: { size: 10 }, color: '#888780', maxRotation: 45, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
              y: { min: 0, max: 100, title: { display: true, text: 'Voted same way (%)', font: { size: 10 }, color: '#888780' }, ticks: { font: { size: 10 }, color: '#888780', callback: (v: number | string) => Number(v) % 25 === 0 ? v + '%' : '', stepSize: 25 }, grid: { color: 'rgba(136,135,128,0.15)' } },
            },
          },
        })
      }

      if (c2.current) {
        chart2.current = new Chart(c2.current, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Total divisions that month', data: totals, backgroundColor: '#E2E8F0', borderRadius: 3 },
              { label: 'Both blocs voted same way', data: agreed, backgroundColor: '#34D399', borderRadius: 3 },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#1a2a3a',
                titleColor: '#ffffff',
                bodyColor: '#a0b8c8',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 6,
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                bodySpacing: 4,
                displayColors: false,
                callbacks: {
                  title: (items: TooltipItem<'bar'>[]) => {
                    const idx = items[0].dataIndex
                    const d = new Date(data[idx].month)
                    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    return `${mn[d.getMonth()]} ${d.getFullYear()}`
                  },
                  label: (item: TooltipItem<'bar'>) => {
                    const idx = item.dataIndex
                    const row = data[idx]
                    if (item.datasetIndex === 0) return `Total divisions: ${row.total_divisions}`
                    return `Both blocs voted same way: ${row.agreed_divisions}`
                  },
                },
              },
            },
            scales: {
              x: { ticks: { font: { size: 10 }, color: '#888780', maxRotation: 45, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
              y: { ticks: { font: { size: 10 }, color: '#888780', stepSize: 5 }, grid: { color: 'rgba(136,135,128,0.15)' }, beginAtZero: true },
            },
          },
        })
      }
    })
    return () => {
      if (chart1.current) { chart1.current.destroy(); chart1.current = null }
      if (chart2.current) { chart2.current.destroy(); chart2.current = null }
    }
  }, [data])

  function getAgreementColor(pct: number | null): string {
    if (pct === null) return 'var(--text-primary)'
    if (pct >= 60) return '#065F46'
    if (pct >= 30) return '#92400E'
    return '#9B2626'
  }

  const peakMonth = data
    .filter(r => r.total_divisions >= 3 && r.agreement_pct !== null)
    .sort((a, b) => (b.agreement_pct ?? 0) - (a.agreement_pct ?? 0))[0] ?? null
  const latestWithData = [...data].at(-1) ?? null
  const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const peakLabel = peakMonth ? (() => { const d = new Date(peakMonth.month); return `${mn[d.getMonth()]} ${d.getFullYear()}` })() : ''
  const latestLabel = latestWithData ? (() => { const d = new Date(latestWithData.month); return `${mn[d.getMonth()]} ${d.getFullYear()}` })() : ''

  return (
    <div>
      <div className={styles.overviewGridThree}>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Period</span>
          <span className={styles.overviewValue}>24</span>
          <span className={styles.overviewMeta}>months rolling</span>
        </div>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Highest agreement month</span>
          <span className={styles.overviewValue}>{peakMonth?.agreement_pct ?? '—'}%</span>
          <span className={styles.overviewMeta}>{peakLabel} ({peakMonth?.total_divisions} divisions)</span>
        </div>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Most recent month</span>
          <span className={styles.overviewValue} style={{ color: getAgreementColor(latestWithData?.agreement_pct ?? null) }}>
            {latestWithData?.agreement_pct ?? '—'}%
          </span>
          <span className={styles.overviewMeta}>{latestLabel} ({latestWithData?.total_divisions} divisions)</span>
        </div>
      </div>

      <h3 className={styles.chartTitle}>Percentage of divisions where both blocs voted the same way</h3>
      <div className={styles.trendLegend}>
        <span className={styles.trendLegendItem}><span className={styles.trendDotLg} />3+ divisions</span>
        <span className={styles.trendLegendItem}><span className={styles.trendDotSm} />Fewer than 3 divisions</span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: '260px', marginBottom: '0.5rem' }}>
        <canvas ref={c1} role="img" aria-label="Line chart showing monthly unionist nationalist agreement rate over the last 24 months" />
      </div>
      <div className="note-card">
        <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
          <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
          <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
        </svg>
        <p>Percentage of divisions in each month where the majority of unionist and nationalist MLAs voted the same way (both majority Aye or both majority No). Smaller points indicate months with fewer than 3 divisions, which are less statistically reliable.</p>
      </div>

      <h3 className={styles.chartTitle}>Bloc voting agreement by month</h3>
      <p className={styles.trendNote} style={{ marginBottom: '0.75rem' }}>How many divisions each month saw both unionist and nationalist MLAs vote the same way, compared to the total number of divisions that month.</p>
      <div className={styles.trendLegend}>
        <span className={styles.trendLegendItem}><span className={styles.trendDotTotal} />Total divisions that month</span>
        <span className={styles.trendLegendItem}><span className={styles.trendDotAgreed} />Both blocs voted same way</span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: '240px' }}>
        <canvas ref={c2} role="img" aria-label="Grouped bar chart showing total divisions versus cross-community agreed divisions per month over the last 24 months" />
      </div>
    </div>
  )
}
