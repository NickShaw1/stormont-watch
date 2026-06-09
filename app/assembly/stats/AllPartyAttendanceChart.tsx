'use client'

import { useEffect, useRef } from 'react'
import { partyBorderColor, abbreviateParty } from '@/lib/format'
import styles from './stats.module.css'

interface TrendPoint { party: string; month: string; attendancePct: number; memberCount: number }

const MIN_MLAS = 3

function pivotByParty(data: TrendPoint[]) {
  const parties = [...new Set(data.map(d => d.party))]
  // Filter to parties with enough MLAs (use max memberCount across months as proxy)
  const partyMaxMembers: Record<string, number> = {}
  for (const d of data) {
    partyMaxMembers[d.party] = Math.max(partyMaxMembers[d.party] ?? 0, d.memberCount)
  }
  const eligible = parties.filter(p => (partyMaxMembers[p] ?? 0) > MIN_MLAS)

  const months = [...new Set(data.map(d => d.month))]

  const byParty: Record<string, Record<string, number>> = {}
  for (const d of data) {
    if (!byParty[d.party]) byParty[d.party] = {}
    byParty[d.party][d.month] = d.attendancePct
  }

  return { eligible, months, byParty }
}

function getLatestMonthStats(data: TrendPoint[], eligible: string[], months: string[], byParty: Record<string, Record<string, number>>) {
  // Find the most recent month that has data for at least one eligible party
  const lastMonth = [...months].reverse().find(m => eligible.some(p => byParty[p]?.[m] !== undefined))
  if (!lastMonth) return null

  const scores = eligible
    .map(p => ({ party: p, pct: byParty[p]?.[lastMonth] }))
    .filter((x): x is { party: string; pct: number } => x.pct !== undefined)
    .sort((a, b) => b.pct - a.pct)

  return {
    month: lastMonth,
    highest: scores[0] ?? null,
    lowest: scores[scores.length - 1] ?? null,
  }
}

export default function AllPartyAttendanceChart({ data }: { data: TrendPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<{ destroy: () => void } | null>(null)

  const { eligible, months, byParty } = pivotByParty(data)
  const latest = getLatestMonthStats(data, eligible, months, byParty)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false

    function initChart() {
      if (cancelled || !canvasRef.current) return
      if (canvasRef.current.offsetWidth === 0) return

      import('chart.js/auto').then(({ Chart }) => {
        if (cancelled || !canvasRef.current) return
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

        const datasets = eligible.map(party => {
          const color = partyBorderColor(party)
          return {
            label: abbreviateParty(party),
            data: months.map(m => byParty[party]?.[m] ?? null),
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: color,
            tension: 0.4,
            spanGaps: true,
          }
        })

        chartRef.current = new Chart(canvasRef.current, {
          type: 'line',
          data: { labels: months, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                itemSort: (a, b) => (b.raw as number) - (a.raw as number),
                multiKeyBackground: 'rgba(0,0,0,0.8)',
                callbacks: {
                  label: (item) => `${item.dataset.label}: ${item.raw}%`,
                  labelColor: (item) => ({ borderColor: 'transparent', backgroundColor: item.dataset.borderColor as string, borderWidth: 0, borderRadius: 2 }),
                },
              },
            },
            scales: {
              y: {
                min: 0,
                max: 100,
                grid: { color: 'rgba(0,0,0,0.06)' },
                ticks: { font: { size: 11 }, callback: (v) => `${v}%` },
              },
              x: {
                grid: { display: false },
                ticks: {
                  font: { size: 10 },
                  maxRotation: 0,
                  autoSkip: false,
                  callback: function(val) {
                    const label = (this as { getLabelForValue(v: number): string }).getLabelForValue(val as number)
                    if (label.startsWith('Jan')) return label
                    if ((canvasRef.current?.offsetWidth ?? 0) < 480) return ''
                    const month = label.split(' ')[0]
                    return ['Apr', 'Jul', 'Oct'].includes(month) ? month : ''
                  },
                },
              },
            },
          },
        })
      })
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) { initChart(); observer.disconnect(); break }
      }
    })
    observer.observe(canvas)
    initChart()

    return () => {
      cancelled = true
      observer.disconnect()
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return (
    <div>
      {/* Summary cards */}
      {latest && (
        <div className={styles.overviewGrid} style={{ marginBottom: 'var(--s-5)' }}>
          {latest.highest && (
            <div className={styles.overviewCard}>
              <span className={styles.overviewLabel}>Highest attendance</span>
              <span className={styles.overviewValue} style={{ color: 'var(--forest)' }}>
                {latest.highest.pct}%
              </span>
              <span className={styles.overviewMeta}>
                {abbreviateParty(latest.highest.party)} &middot; {latest.month}
              </span>
            </div>
          )}
          {latest.lowest && latest.lowest.party !== latest.highest?.party && (
            <div className={styles.overviewCard}>
              <span className={styles.overviewLabel}>Lowest attendance</span>
              <span className={styles.overviewValue} style={{ color: 'var(--crimson)' }}>
                {latest.lowest.pct}%
              </span>
              <span className={styles.overviewMeta}>
                {abbreviateParty(latest.lowest.party)} &middot; {latest.month}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className={styles.trendLegendCompact}>
        {eligible.map(party => (
          <span key={party} className={styles.trendLegendItem}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: partyBorderColor(party), display: 'inline-block', flexShrink: 0 }} />
            {abbreviateParty(party)}
          </span>
        ))}
      </div>


      {/* Chart */}
      <div style={{ position: 'relative', width: '100%', height: '220px' }}>
        <canvas ref={canvasRef} role="img" aria-label="Party division attendance over time (multi-line chart)" />
      </div>

      <div className="note-card" style={{ marginTop: 'var(--s-3)' }}>
        <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
          <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
          <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
        </svg>
        <p>Only parties with more than {MIN_MLAS} MLAs are shown. Only months with recorded divisions are included. Excludes presiding officers and divisions before each MLA&apos;s mandate start date.</p>
      </div>
    </div>
  )
}
