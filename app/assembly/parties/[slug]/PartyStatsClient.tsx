'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, formatConstituency, formatDate } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import type { PartyVoteStats, MlaAttendanceStat } from '@/lib/db/queries'
import styles from './partyDetail.module.css'
import { useMandate } from '@/components/MandateContext'

interface PartyStatsProps {
  stats: PartyVoteStats
  partyColor: string
  mlaCount: number
}



function MlaStatRow({ mla }: { mla: MlaAttendanceStat }) {
  const { basePath } = useMandate()
  return (
    <Link href={`${basePath}/assembly/mlas/${mla.personId}`} className={styles.statMlaRow}>
      <div className={styles.statMlaPhoto}>
        <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={40} decorative square />
      </div>
      <div className={styles.statMlaInfo}>
        <span className={styles.statMlaName}>{formatMemberName(mla.fullName)}</span>
        {mla.constituency && (
          <span className={styles.statMlaConstituency}>{formatConstituency(mla.constituency)}</span>
        )}
      </div>
      <div className={styles.statMlaValueCol}>
        <span className={styles.statMlaPct}>{mla.attendancePct}%</span>
        <span className={styles.statMlaCount}>{mla.present}/{mla.total}</span>
      </div>
    </Link>
  )
}

function DonutChart({ stats }: { stats: PartyVoteStats; partyColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<{ destroy: () => void } | null>(null)

  const total = stats.aye + stats.no + stats.abstained + stats.noShow

  useEffect(() => {
    const centreTextPlugin = {
      id: 'centreText',
      beforeDraw(chart: import('chart.js').Chart<'doughnut'>) {
        const { ctx, chartArea: { top, bottom, left, right } } = chart
        const cx = (left + right) / 2
        const cy = (top + bottom) / 2
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#222'
        ctx.font = '500 18px sans-serif'
        ctx.fillText(total.toLocaleString(), cx, cy - 8)
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim() || '#888'
        ctx.font = '400 11px sans-serif'
        ctx.fillText('votes', cx, cy + 10)
        ctx.restore()
      }
    }

    import('chart.js/auto').then(({ Chart }) => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
      if (!canvasRef.current) return
      chartRef.current = new Chart(canvasRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Aye', 'No', 'Abstain', 'No Show'],
          datasets: [{
            data: [stats.aye, stats.no, stats.abstained, stats.noShow],
            backgroundColor: ['#2E6B40', '#8B1A1A', '#B8860B', '#888888'],
            borderWidth: 0,
          }],
        },
        options: {
          cutout: '65%',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (item) => `${item.label}: ${(item.raw as number).toLocaleString()}`,
              },
            },
          },
        },
        plugins: [centreTextPlugin],
      })
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [stats, total])

  const legendItems = [
    { label: 'Aye', count: stats.aye, color: '#2E6B40' },
    { label: 'No', count: stats.no, color: '#8B1A1A' },
    { label: 'Abstain', count: stats.abstained, color: '#B8860B' },
    { label: 'No show', count: stats.noShow, color: '#888888' },
  ]

  return (
    <>
      <div style={{ position: 'relative', flex: 1, minHeight: 140, marginTop: 'var(--s-3)' }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Voting breakdown: Aye ${stats.aye.toLocaleString()}, No ${stats.no.toLocaleString()}, Abstain ${stats.abstained.toLocaleString()}, No show ${stats.noShow.toLocaleString()}`}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
        />
      </div>
      <div className={styles.donutLegend}>
        {legendItems.map((item) => (
          <div key={item.label} className={styles.donutLegendItem}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ color: 'var(--ink-3)' }}>{item.label}</span>
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{item.count.toLocaleString()}</span>
            <span style={{ color: 'var(--ink-4)' }}>{total > 0 ? Math.round(item.count / total * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </>
  )
}

function TrendChart({ trend, partyColor }: { trend: PartyVoteStats['trend']; partyColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<{ destroy: () => void } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false

    function initChart() {
      if (cancelled) return
      if (!canvasRef.current) return
      if (canvasRef.current.offsetWidth === 0) return

      import('chart.js/auto').then(({ Chart }) => {
        if (cancelled) return
        if (!canvasRef.current) return
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
        chartRef.current = new Chart(canvasRef.current, {
          type: 'line',
          data: {
            labels: trend.map((p) => p.month),
            datasets: [{
              data: trend.map((p) => p.attendancePct),
              borderColor: partyColor,
              backgroundColor: partyColor + '22',
              fill: true,
              pointRadius: 3,
              pointHoverRadius: 5,
              tension: 0.3,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (item) => `${item.raw}%`,
                },
              },
            },
            scales: {
              y: {
                min: 0,
                max: 100,
                grid: { color: 'rgba(0,0,0,0.06)' },
                ticks: {
                  font: { size: 11 },
                  callback: (v) => `${v}%`,
                },
              },
              x: {
                grid: { display: false },
                ticks: {
                  font: { size: 11 },
                  maxRotation: 0,
                  autoSkip: false,
                  callback: function(val) {
                    const label = (this as { getLabelForValue(v: number): string }).getLabelForValue(val as number)
                    return label.startsWith('Jan') ? label : ''
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
        if (entry.contentRect.width > 0) {
          initChart()
          observer.disconnect()
          break
        }
      }
    })

    observer.observe(canvas)
    initChart()

    return () => {
      cancelled = true
      observer.disconnect()
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    }
  }, [trend, partyColor])

  return <canvas ref={canvasRef} role="img" aria-label="Party Division Attendance over time (line chart)" />
}

export default function PartyStatsClient({ stats, partyColor, mlaCount }: PartyStatsProps) {
  const { mandate, basePath } = useMandate()
  const singleMla = mlaCount === 1 || stats.highestMla.personId === stats.lowestMla.personId

  return (
    <div className={styles.statsSection}>
      {/* Metric cards */}
      <div className={styles.statsGrid}>
        {/* Attendance card */}
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Party Division Attendance Average</span>
          <span className={styles.statValue}>{stats.attendancePct}%</span>
          <span className={styles.statSub}>Across current and former MLAs in the {mandate.label} mandate, excluding presiding officers</span>
          <span className={styles.statSub}><strong>{stats.present.toLocaleString()} / {stats.total.toLocaleString()}</strong> divisions party participated in</span>
          <div className={styles.statDivider} />
          {singleMla ? (
            <MlaStatRow mla={stats.highestMla} />
          ) : (
            <>
              <div className={styles.statMlaArrow} style={{ color: 'var(--forest)' }}>↑ Highest</div>
              <MlaStatRow mla={stats.highestMla} />
              <div className={styles.statMlaSep} />
              <div className={styles.statMlaArrow} style={{ color: 'var(--crimson)' }}>↓ Lowest</div>
              <MlaStatRow mla={stats.lowestMla} />
            </>
          )}
          <p className={styles.statNote}>Based on division participation, excluding Speakers and First/Deputy First Ministers</p>
        </div>

        {/* Donut card */}
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Voting Breakdown</span>
          <span className={styles.statSub}>All votes cast by current and former MLAs, excluding presiding officers</span>
          <DonutChart stats={stats} partyColor={partyColor} />
        </div>
      </div>

      {/* Trend chart */}
      <hr className="section-rule" />
      <h3 className={styles.expensesSectionHeading} style={{ marginBottom: 'var(--s-4)' }}>Party Division <em>Attendance</em></h3>
      <div style={{ position: 'relative', width: '100%', height: '200px' }}>
        <TrendChart trend={stats.trend} partyColor={partyColor} />
      </div>
      <div className="note-card" style={{ marginTop: 'var(--s-3)' }}>
        <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
          <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
          <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
        </svg>
        <p>Only months with recorded divisions are shown. Excludes presiding officers and divisions before each MLA&apos;s mandate start date.</p>
      </div>

      <hr className="section-rule" />
      {/* Recent divisions */}
      <h3 className={styles.statsHeading}>Recent divisions</h3>
      {/* Desktop table */}
      <div className={styles.divisionsTable}>
        <table className={styles.divTable}>
          <colgroup>
            <col style={{ width: 'auto' }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 120 }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Division</th>
              <th scope="col">Party vote</th>
              <th scope="col">Result</th>
              <th scope="col">Date</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentDivisions.map((d, i) => {
              const { title, subtitle } = formatDivisionSubject(d.title ?? d.subject)
              const passed = /carried|agreed/i.test(d.outcome ?? '') ? true : /negatived|fell/i.test(d.outcome ?? '') ? false : null
              const voteLabel = d.partyVote === 'AYE' ? 'Aye' : d.partyVote === 'NO' ? 'No' : d.partyVote === 'ABSTAINED' ? 'Abstain' : d.partyVote === 'NO_SHOW' ? 'No show' : null
              const voteCls = d.partyVote === 'AYE' ? 'vote-aye' : d.partyVote === 'NO' ? 'vote-no' : d.partyVote === 'ABSTAINED' ? 'vote-abstain' : 'vote-noshow'
              return (
                <tr key={d.documentId} className={i % 2 === 1 ? styles.divRowEven : ''}>
                  <td className={styles.divSubjectCell}>
                    <Link href={`${basePath}/assembly/divisions/${d.documentId}`} className={styles.divSubjectLink}>
                      <span className={styles.divSubjectTitle}>{title}</span>
                      {subtitle && <span className={styles.divSubjectSub}>{subtitle}</span>}
                    </Link>
                  </td>
                  <td className={styles.divResultCell}>
                    {voteLabel && <span className={`vote-pill ${voteCls}`}>{voteLabel}</span>}
                  </td>
                  <td className={styles.divResultCell}>
                    {passed !== null && <span className={`pill ${passed ? 'pass' : 'fail'}`}>{passed ? 'Passed' : 'Failed'}</span>}
                  </td>
                  <td className={styles.divDateCell}>{formatDate(d.divisionDate)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className={styles.divMobileCards}>
        {stats.recentDivisions.map((d) => {
          const { title, subtitle } = formatDivisionSubject(d.title ?? d.subject)
          const passed = /carried|agreed/i.test(d.outcome ?? '') ? true : /negatived|fell/i.test(d.outcome ?? '') ? false : null
          const voteLabel = d.partyVote === 'AYE' ? 'Aye' : d.partyVote === 'NO' ? 'No' : d.partyVote === 'ABSTAINED' ? 'Abstain' : d.partyVote === 'NO_SHOW' ? 'No show' : null
          const voteCls = d.partyVote === 'AYE' ? 'vote-aye' : d.partyVote === 'NO' ? 'vote-no' : d.partyVote === 'ABSTAINED' ? 'vote-abstain' : 'vote-noshow'
          return (
            <Link key={`mob-${d.documentId}`} href={`${basePath}/assembly/divisions/${d.documentId}`} className={styles.divMobileCard}>
              <div className={styles.divMobileTitle}>{title}</div>
              <div className={styles.divMobileSub} aria-hidden={!subtitle || undefined}>
                {subtitle ?? <span aria-hidden="true">&nbsp;</span>}
              </div>
              <div className={styles.divMobilePills}>
                <span className={styles.divMobilePillGroup}>
                  <span className={styles.divMobilePillLabel}>Vote</span>
                  {voteLabel && <span className={`vote-pill ${voteCls}`}>{voteLabel}</span>}
                </span>
                <span className={styles.divMobilePillGroup}>
                  <span className={styles.divMobilePillLabel}>Result</span>
                  {passed !== null && <span className={`pill ${passed ? 'pass' : 'fail'}`}>{passed ? 'Passed' : 'Failed'}</span>}
                </span>
                <span className={styles.divMobileDate}>{formatDate(d.divisionDate)}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
