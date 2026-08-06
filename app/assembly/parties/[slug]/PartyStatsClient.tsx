'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import Link from 'next/link'
import { TrendingUp, ListChecks, Scale, FileText, Megaphone, PenLine } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import BillStagePill from '@/app/components/BillStagePill'
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
    <Link href={`${basePath}/assembly/mlas/${mla.personId}`} className={styles.factRow}>
      <div className={styles.factRowPhoto}>
        <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={40} decorative square personId={mla.personId} />
      </div>
      <div className={styles.factRowInfo}>
        <span className={styles.factRowName}>{formatMemberName(mla.fullName)}</span>
        {mla.constituency && (
          <span className={styles.factRowConstituency}>{formatConstituency(mla.constituency)}</span>
        )}
      </div>
      <div className={styles.factRowValueCol}>
        <span className={styles.factRowValue}>{mla.attendancePct}%</span>
        <span className={styles.factRowSub}>{mla.present}/{mla.total}</span>
      </div>
    </Link>
  )
}

function DonutChart({ stats }: { stats: PartyVoteStats; partyColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<{ destroy: () => void } | null>(null)

  const total = stats.aye + stats.no + stats.abstained + stats.noShow

  useEffect(() => {
    const root = getComputedStyle(document.documentElement)
    const colorAye = root.getPropertyValue('--sw-success').trim() || '#2f6a4f'
    const colorNo = root.getPropertyValue('--sw-error').trim() || '#a4301f'
    const colorAbstain = root.getPropertyValue('--sw-accent-warm').trim() || '#e0a72a'
    const colorNoShow = root.getPropertyValue('--sw-text-tertiary').trim() || '#656b72'
    const textPrimary = root.getPropertyValue('--sw-text-primary').trim() || '#1a1d21'
    const textTertiary = root.getPropertyValue('--sw-text-tertiary').trim() || '#656b72'

    const centreTextPlugin = {
      id: 'centreText',
      beforeDraw(chart: import('chart.js').Chart<'doughnut'>) {
        const { ctx, chartArea: { top, bottom, left, right } } = chart
        const cx = (left + right) / 2
        const cy = (top + bottom) / 2
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = textPrimary
        ctx.font = '700 18px sans-serif'
        ctx.fillText(total.toLocaleString(), cx, cy - 8)
        ctx.fillStyle = textTertiary
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
            backgroundColor: [colorAye, colorNo, colorAbstain, colorNoShow],
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
    { label: 'Aye', count: stats.aye, cls: 'success' as const },
    { label: 'No', count: stats.no, cls: 'error' as const },
    { label: 'Abstain', count: stats.abstained, cls: 'warm' as const },
    { label: 'No show', count: stats.noShow, cls: 'tertiary' as const },
  ]

  const swatchColor: Record<typeof legendItems[number]['cls'], string> = {
    success: 'var(--sw-success)',
    error: 'var(--sw-error)',
    warm: 'var(--sw-accent-warm)',
    tertiary: 'var(--sw-text-tertiary)',
  }

  return (
    <>
      <div className={styles.donutArea}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Voting breakdown: Aye ${stats.aye.toLocaleString()}, No ${stats.no.toLocaleString()}, Abstain ${stats.abstained.toLocaleString()}, No show ${stats.noShow.toLocaleString()}`}
        />
      </div>
      <div className={styles.donutGlanceGrid}>
        {legendItems.map((item) => (
          <div key={item.label} className={styles.donutGlanceCell}>
            <span className={styles.donutGlanceLabel}>
              <span className={styles.donutLegendSwatch} style={{ background: swatchColor[item.cls] }} />
              {item.label}
            </span>
            <span className={styles.donutGlanceValueRow}>
              <span className={styles.donutGlanceCount}>{item.count.toLocaleString()}</span>
              <span className={styles.donutGlancePct}>{total > 0 ? Math.round(item.count / total * 100) : 0}%</span>
            </span>
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

      const root = getComputedStyle(document.documentElement)
      const tickColor = root.getPropertyValue('--sw-text-tertiary').trim() || '#656b72'
      const gridColor = root.getPropertyValue('--sw-border').trim() || '#dcded9'

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
                grid: { color: gridColor },
                ticks: {
                  color: tickColor,
                  font: { size: 11 },
                  callback: (v) => `${v}%`,
                },
              },
              x: {
                grid: { display: false },
                ticks: {
                  color: tickColor,
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
    <div>
      {/* Metric panels */}
      <div className={styles.factPanelGrid}>
        {/* Attendance panel */}
        <div className={styles.factPanel}>
          {/* Row 1: party-wide average */}
          <span className={styles.factLabel}>Party-wide vote attendance average</span>
          <span className={styles.factValue}>{stats.attendancePct}%</span>
          <ul className={styles.factSubList}>
            <li>Average share of votes cast (not a no-show) across current and former MLAs in the {mandate.label} mandate, excluding the Speaker (who does not vote by convention).</li>
          </ul>

          <div className={styles.factDivider} />

          {/* Row 2: division coverage */}
          <span className={styles.factLabel}>Divisions with at least one party vote cast</span>
          <span className={styles.factValue}>{stats.present.toLocaleString()} / {stats.total.toLocaleString()}</span>

          <div className={styles.factDivider} />

          {/* Row 2: highest/lowest individual MLA */}
          <span className={styles.factLabel}>{singleMla ? 'MLA attendance' : 'Highest and lowest MLA attendance'}</span>
          {singleMla ? (
            <MlaStatRow mla={stats.highestMla} />
          ) : (
            <>
              <div className={styles.factRankGroup} style={{ '--rank-c': 'var(--sw-success)' } as CSSProperties}>
                <div className={styles.factRankLabel} style={{ color: 'var(--sw-success)' }}>↑ Highest</div>
                <MlaStatRow mla={stats.highestMla} />
              </div>
              <div className={styles.factRankSep} />
              <div className={styles.factRankGroup} style={{ '--rank-c': 'var(--sw-error)' } as CSSProperties}>
                <div className={styles.factRankLabel} style={{ color: 'var(--sw-error)' }}>↓ Lowest</div>
                <MlaStatRow mla={stats.lowestMla} />
              </div>
            </>
          )}
          <p className={styles.factFootnote} style={{ marginTop: 'var(--s-3)' }}>* Excludes presiding officers (Speaker, Deputy Speaker, Principal Deputy Speaker) and the First/Deputy First Minister.</p>
        </div>

        {/* Donut panel */}
        <div className={styles.factPanel}>
          <span className={styles.factLabel}>Voting breakdown</span>
          <span className={styles.factSub}>All votes cast by current and former MLAs, excluding the Speaker (who does not vote by convention).</span>
          <DonutChart stats={stats} partyColor={partyColor} />
        </div>
      </div>

      {/* Trend chart */}
      <div className={`${styles.sectionHead} ${styles.sectionHeadWithSubtitle}`}>
        <span className={styles.sectionEyebrow}>Trends</span>
        <h3 className={styles.sectionHeading}>
          <TrendingUp className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
          Party division attendance
        </h3>
        <p className={styles.sectionSubtitle}>Only months with recorded divisions are shown. Excludes the Speaker and divisions before each MLA&apos;s mandate start date.</p>
      </div>
      <div className={styles.chartArea}>
        <TrendChart trend={stats.trend} partyColor={partyColor} />
      </div>

      {/* Recent divisions — matches the MLA detail page's voting record row. */}
      <div className={`${styles.subHeadRow} ${styles.subHeadingSpaced}`}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>Voting record</span>
          <h3 className={styles.sectionHeading}>
            <ListChecks className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Party vote on recent divisions
          </h3>
        </div>
        <Link href={`${basePath}/assembly/votes`} className={styles.viewAllBtn}>All divisions</Link>
      </div>
      <div className={styles.voteRowList}>
        {stats.recentDivisions.map((d) => {
          const voteLabel = d.partyVote === 'AYE' ? 'Aye' : d.partyVote === 'NO' ? 'No' : d.partyVote === 'ABSTAINED' ? 'Abstain' : d.partyVote === 'NO_SHOW' ? 'No Show' : null
          const voteChipCls = d.partyVote === 'AYE' ? styles.voteChipAYE : d.partyVote === 'NO' ? styles.voteChipNO : d.partyVote === 'ABSTAINED' ? styles.voteChipABSTAINED : styles.voteChipNO_SHOW
          const passed = /carried|agreed/i.test(d.outcome ?? '') ? true : /negatived|fell/i.test(d.outcome ?? '') ? false : null
          const raw = d.title ?? d.subject
          const { title, subtitle, stage } = formatDivisionSubject(raw)

          const amendmentMatch = subtitle?.match(/^Amendment (\d+)$/)
          const stageText = stage

          // Same category derivation as the homepage's Recent Divisions.
          const t = d.title ?? ''
          const s = d.subject ?? ''
          const isStatutory = /^The draft /i.test(t) || /^Prayer of Annulment:/i.test(t) || /^Applicability Motion/i.test(t)
          const isBill = !isStatutory && (/NIA Bill/i.test(s) || /(?:First|Second|Committee|Consideration|Further Consideration|Final) Stage:/i.test(s))
          const category = isStatutory ? 'Regulations' : isBill ? 'Bill' : 'Motion'
          const CategoryIcon = isStatutory ? FileText : isBill ? Scale : Megaphone
          const categoryCls = isStatutory ? styles.chipRegulations : isBill ? styles.chipBill : styles.chipMotion

          return (
            <Link
              key={d.documentId}
              href={`${basePath}/assembly/divisions/${d.documentId}`}
              className={styles.voteRow}
              aria-label={`View division: ${title}`}
            >
              <div className={styles.voteRowMain}>
                <span className={styles.voteRowTitle}>{title}</span>
                <div className={styles.voteRowChips}>
                  <span className={`${styles.divChip} ${categoryCls}`}>
                    <CategoryIcon size={12} strokeWidth={2} aria-hidden="true" />
                    {category}
                  </span>
                  {stageText && (
                    <BillStagePill category="in-progress" currentStage={stageText} passed={null} />
                  )}
                  {amendmentMatch && (
                    <span className={`${styles.divChip} ${styles.chipAmendment}`}>
                      <PenLine size={12} strokeWidth={2} aria-hidden="true" />
                      Amendment {amendmentMatch[1]}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.voteRowMeta}>
                {(voteLabel || passed !== null) && (
                  <span className={styles.voteOutcomeLine}>
                    {voteLabel && (
                      <span className={styles.voteOutcomePair}>
                        <span className={styles.voteOutcomeLabel}>Party voted</span>
                        <span className={voteChipCls}>{voteLabel}</span>
                      </span>
                    )}
                    {voteLabel && passed !== null && <span className={styles.voteOutcomeSep}>&middot;</span>}
                    {passed !== null && (
                      <span className={styles.voteOutcomePair}>
                        <span className={styles.voteOutcomeLabel}>Result</span>
                        <span className={passed ? styles.voteOutcomePass : styles.voteOutcomeFail}>
                          {passed ? 'Passed' : 'Failed'}
                        </span>
                      </span>
                    )}
                  </span>
                )}
                <span className={styles.voteRowDateCaption}>{formatDate(d.divisionDate)}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
