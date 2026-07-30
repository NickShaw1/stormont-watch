'use client'

import { useRef, useEffect, useState, useMemo, type CSSProperties } from 'react'
import Link from 'next/link'
import { TrendingUp, ListChecks, CalendarCheck, MessagesSquare } from 'lucide-react'
import styles from './partyDetail.module.css'
import { formatMemberName, formatConstituency } from '@/lib/format'
import MlaPhoto from '@/components/MlaPhoto'
import { useMandate } from '@/components/MandateContext'
import { sittingAdjective } from '@/lib/constants/mandates'

interface Props {
  hansardStats: { personId: string; fullName: string; constituency: string | null; imgUrl: string | null; sittings: number; debates: number }[]
  hansardPartyRank: { rank: number; totalParties: number; avgSittings: number } | null
  hansardPartyDebateRank: { rank: number; totalParties: number; avgDebates: number } | null
  hansardSittingsByMonth: { year: number; month: number; totalSittings: number }[]
  partyColor: string
  party: string
}

export default function PartyChamberClient({ hansardStats, hansardPartyRank, hansardPartyDebateRank, hansardSittingsByMonth, partyColor, party }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { mandate, basePath } = useMandate()
  const [sortBy, setSortBy] = useState<'sittings' | 'debates'>('sittings')

  const parsedStats = useMemo(() =>
    hansardStats.map(r => ({ ...r, sittings: Number(r.sittings), debates: Number(r.debates) })),
    [hansardStats]
  )

  const sorted = useMemo(() =>
    [...parsedStats].sort((a, b) => sortBy === 'sittings' ? b.sittings - a.sittings : b.debates - a.debates),
    [parsedStats, sortBy]
  )

  const topBySittings = parsedStats.reduce<typeof parsedStats[0] | null>(
    (best, r) => !best || r.sittings > best.sittings ? r : best, null
  )
  const topByDebates = parsedStats.reduce<typeof parsedStats[0] | null>(
    (best, r) => !best || r.debates > best.debates ? r : best, null
  )
  const fewestBySittings = parsedStats.reduce<typeof parsedStats[0] | null>(
    (best, r) => !best || r.sittings < best.sittings ? r : best, null
  )
  const fewestByDebates = parsedStats.reduce<typeof parsedStats[0] | null>(
    (best, r) => !best || r.debates < best.debates ? r : best, null
  )

  const maxValue = sorted[0] ? (sortBy === 'sittings' ? sorted[0].sittings : sorted[0].debates) : 1

  const sittingsRankColor = (() => {
    if (!hansardPartyRank) return 'var(--sw-text-tertiary)'
    const pctile = hansardPartyRank.totalParties > 1
      ? (hansardPartyRank.rank - 1) / (hansardPartyRank.totalParties - 1)
      : 0
    return pctile <= 0.33 ? 'var(--sw-success)' : pctile <= 0.66 ? 'var(--sw-warning)' : 'var(--sw-error)'
  })()

  const debatesRankColor = (() => {
    if (!hansardPartyDebateRank) return 'var(--sw-text-tertiary)'
    const pctile = hansardPartyDebateRank.totalParties > 1
      ? (hansardPartyDebateRank.rank - 1) / (hansardPartyDebateRank.totalParties - 1)
      : 0
    return pctile <= 0.33 ? 'var(--sw-success)' : pctile <= 0.66 ? 'var(--sw-warning)' : 'var(--sw-error)'
  })()

  const mlaCount = parsedStats.length

  useEffect(() => {
    if (!canvasRef.current) return

    const now = new Date()
    const months: { year: number; month: number; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      })
    }

    const spokenMap = new Map(hansardSittingsByMonth.map(r => [`${r.year}-${r.month}`, r.totalSittings]))
    const labels = months.map(m => m.label)
    const data = months.map(m => {
      const sittings = spokenMap.get(`${m.year}-${m.month}`) ?? 0
      return mlaCount > 0 ? Math.round((sittings / mlaCount) * 10) / 10 : 0
    })

    const root = getComputedStyle(document.documentElement)
    const tickColor = root.getPropertyValue('--sw-text-tertiary').trim() || '#656b72'
    const gridColor = root.getPropertyValue('--sw-border').trim() || '#dcded9'

    let chart: { destroy: () => void } | null = null

    import('chart.js/auto').then(({ default: Chart }) => {
      if (!canvasRef.current) return
      const existing = Chart.getChart(canvasRef.current)
      if (existing) existing.destroy()
      chart = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data,
            borderColor: partyColor,
            backgroundColor: partyColor + '18',
            borderWidth: 2,
            pointRadius: 3,
            fill: true,
            tension: 0.3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
              legend: { display: false },
              tooltip: {
                mode: 'index',
                multiKeyBackground: partyColor,
                callbacks: {
                  labelColor: () => ({ borderColor: partyColor, backgroundColor: partyColor, borderDash: [0, 0], borderRadius: 2 }),
                },
              },
            },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: tickColor } },
            y: { beginAtZero: true, ticks: { precision: 1, font: { size: 10 }, color: tickColor }, grid: { color: gridColor } },
          },
        },
      })
    })

    return () => { chart?.destroy() }
  }, [hansardSittingsByMonth, mlaCount, partyColor])

  return (
    <div>
      {/* Glance stats — tinted Key Figures-style cards. */}
      <div className={`${styles.statStrip} ${styles.statStripTwo}`}>
        <div className={styles.statCard}>
          <div className={styles.statCardLabelRow}>
            <span className={styles.statCardLabel}>Avg sittings per current MLA</span>
            <CalendarCheck className={styles.statCardIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.statCardValue}>
            {hansardPartyRank ? hansardPartyRank.avgSittings.toFixed(1) : '-'}
          </span>
          {hansardPartyRank && (
            <span className={styles.statCardSub} style={{ color: sittingsRankColor }}>
              Ranked {hansardPartyRank.rank}/{hansardPartyRank.totalParties}
            </span>
          )}
        </div>

        <div className={styles.statCard} data-tone="amber">
          <div className={styles.statCardLabelRow}>
            <span className={styles.statCardLabel}>Avg debates per current MLA</span>
            <MessagesSquare className={styles.statCardIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className={styles.statCardValue}>
            {hansardPartyDebateRank ? hansardPartyDebateRank.avgDebates.toFixed(1) : '-'}
          </span>
          {hansardPartyDebateRank && (
            <span className={styles.statCardSub} style={{ color: debatesRankColor }}>
              Ranked {hansardPartyDebateRank.rank}/{hansardPartyDebateRank.totalParties}
            </span>
          )}
        </div>
      </div>

      {/* Most/Fewest MLA comparison — plain bordered cards (Pattern B, §4.2). */}
      {parsedStats.length > 1 && (
        <div className={`${styles.rankPanelGrid} ${styles.subHeadingSpaced}`}>
          <div className={styles.rankPanel}>
            <div className={styles.statCardLabelRow}>
              <span className={styles.factLabel}>Sittings</span>
              <CalendarCheck className={styles.rankPanelIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className={styles.factDivider} />
            {topBySittings && (
              <div className={styles.factRankGroup} style={{ '--rank-c': 'var(--sw-success)' } as CSSProperties}>
                <div className={styles.factRankLabel} style={{ color: 'var(--sw-success)' }}>↑ Most</div>
                <Link href={`${basePath}/assembly/mlas/${topBySittings.personId}`} className={styles.factRow}>
                  <div className={styles.factRowPhoto}>
                    <MlaPhoto name={topBySittings.fullName} imgUrl={topBySittings.imgUrl ?? ''} size={40} decorative square personId={topBySittings.personId} />
                  </div>
                  <div className={styles.factRowInfo}>
                    <span className={styles.factRowName}>{formatMemberName(topBySittings.fullName)}</span>
                    {topBySittings.constituency && (
                      <span className={styles.factRowConstituency}>{formatConstituency(topBySittings.constituency)}</span>
                    )}
                  </div>
                  <div className={styles.factRowValueCol}>
                    <span className={styles.factRowValue}>{topBySittings.sittings}</span>
                    <span className={styles.factRowSub}>sittings</span>
                  </div>
                </Link>
              </div>
            )}
            {fewestBySittings && (
              <>
                <div className={styles.factRankSep} />
                <div className={styles.factRankGroup} style={{ '--rank-c': 'var(--sw-error)' } as CSSProperties}>
                  <div className={styles.factRankLabel} style={{ color: 'var(--sw-error)' }}>↓ Fewest</div>
                  <Link href={`${basePath}/assembly/mlas/${fewestBySittings.personId}`} className={styles.factRow}>
                    <div className={styles.factRowPhoto}>
                      <MlaPhoto name={fewestBySittings.fullName} imgUrl={fewestBySittings.imgUrl ?? ''} size={40} decorative square personId={fewestBySittings.personId} />
                    </div>
                    <div className={styles.factRowInfo}>
                      <span className={styles.factRowName}>{formatMemberName(fewestBySittings.fullName)}</span>
                      {fewestBySittings.constituency && (
                        <span className={styles.factRowConstituency}>{formatConstituency(fewestBySittings.constituency)}</span>
                      )}
                    </div>
                    <div className={styles.factRowValueCol}>
                      <span className={styles.factRowValue}>{fewestBySittings.sittings}</span>
                      <span className={styles.factRowSub}>sittings</span>
                    </div>
                  </Link>
                </div>
              </>
            )}
          </div>

          <div className={styles.rankPanel}>
            <div className={styles.statCardLabelRow}>
              <span className={styles.factLabel}>Topics spoken on</span>
              <MessagesSquare className={styles.rankPanelIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className={styles.factDivider} />
            {topByDebates && (
              <div className={styles.factRankGroup} style={{ '--rank-c': 'var(--sw-success)' } as CSSProperties}>
                <div className={styles.factRankLabel} style={{ color: 'var(--sw-success)' }}>↑ Most</div>
                <Link href={`${basePath}/assembly/mlas/${topByDebates.personId}`} className={styles.factRow}>
                  <div className={styles.factRowPhoto}>
                    <MlaPhoto name={topByDebates.fullName} imgUrl={topByDebates.imgUrl ?? ''} size={40} decorative square personId={topByDebates.personId} />
                  </div>
                  <div className={styles.factRowInfo}>
                    <span className={styles.factRowName}>{formatMemberName(topByDebates.fullName)}</span>
                    {topByDebates.constituency && (
                      <span className={styles.factRowConstituency}>{formatConstituency(topByDebates.constituency)}</span>
                    )}
                  </div>
                  <div className={styles.factRowValueCol}>
                    <span className={styles.factRowValue}>{topByDebates.debates}</span>
                    <span className={styles.factRowSub}>topics</span>
                  </div>
                </Link>
              </div>
            )}
            {fewestByDebates && (
              <>
                <div className={styles.factRankSep} />
                <div className={styles.factRankGroup} style={{ '--rank-c': 'var(--sw-error)' } as CSSProperties}>
                  <div className={styles.factRankLabel} style={{ color: 'var(--sw-error)' }}>↓ Fewest</div>
                  <Link href={`${basePath}/assembly/mlas/${fewestByDebates.personId}`} className={styles.factRow}>
                    <div className={styles.factRowPhoto}>
                      <MlaPhoto name={fewestByDebates.fullName} imgUrl={fewestByDebates.imgUrl ?? ''} size={40} decorative square personId={fewestByDebates.personId} />
                    </div>
                    <div className={styles.factRowInfo}>
                      <span className={styles.factRowName}>{formatMemberName(fewestByDebates.fullName)}</span>
                      {fewestByDebates.constituency && (
                        <span className={styles.factRowConstituency}>{formatConstituency(fewestByDebates.constituency)}</span>
                      )}
                    </div>
                    <div className={styles.factRowValueCol}>
                      <span className={styles.factRowValue}>{fewestByDebates.debates}</span>
                      <span className={styles.factRowSub}>topics</span>
                    </div>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className={`${styles.sectionHead} ${styles.sectionHeadSpaced} ${styles.sectionHeadWithSubtitle}`}>
        <span className={styles.sectionEyebrow}>Participation</span>
        <h3 className={styles.sectionHeading}>
          <TrendingUp className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
          Average sittings per MLA by month
        </h3>
        <p className={styles.sectionSubtitle}>
          The average number of plenary sittings spoken in across all {party} MLAs, per month over the last 12 months.
        </p>
      </div>
      <div className={styles.chartAreaSm}>
        <canvas ref={canvasRef} />
      </div>

      {/* Ranking */}
      {parsedStats.length > 1 && sorted.length > 0 && (
        <>
          <div className={`${styles.sectionHead} ${styles.sectionHeadSpaced} ${styles.sectionHeadWithSubtitle}`}>
            <span className={styles.sectionEyebrow}>Rankings</span>
            <h3 className={styles.sectionHeading}>
              <ListChecks className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              MLA chamber activity
            </h3>
            <p className={styles.sectionSubtitle}>
              Each {sittingAdjective(mandate)} MLA&apos;s plenary sittings spoken in and topics contributed to over the last 12 months. Presiding officers are excluded, as their role is procedural rather than representative.
            </p>
          </div>
          <div className={styles.filterRow}>
            <button
              className={`${styles.filterBtn} ${sortBy === 'sittings' ? styles.filterBtnActive : ''}`}
              onClick={() => setSortBy('sittings')}
            >
              Sittings
            </button>
            <button
              className={`${styles.filterBtn} ${sortBy === 'debates' ? styles.filterBtnActive : ''}`}
              onClick={() => setSortBy('debates')}
            >
              Topics
            </button>
          </div>
          <div className={styles.barRowList}>
            {sorted.map((mla, i) => {
              const value = sortBy === 'sittings' ? mla.sittings : mla.debates
              const barPct = maxValue > 0 ? Math.round(value / maxValue * 100) : 0
              return (
                <Link
                  key={mla.personId}
                  href={`${basePath}/assembly/mlas/${mla.personId}`}
                  className={styles.barRow}
                >
                  <span className={styles.barRowRank}>{i + 1}</span>
                  <div className={styles.barRowPhoto}>
                    <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={36} decorative square personId={mla.personId} />
                  </div>
                  <div className={styles.barRowInfo}>
                    <span className={styles.barRowName}>{formatMemberName(mla.fullName)}</span>
                    {mla.constituency && (
                      <span className={`${styles.barRowConstituency} ${styles.barRowConstituencyHideMobile}`}>
                        {formatConstituency(mla.constituency)}
                      </span>
                    )}
                  </div>
                  <div className={styles.barRowBarWrap}>
                    <div className={styles.barRowTrack} aria-hidden="true">
                      <div
                        className={styles.barRowFill}
                        style={{ width: `${barPct}%`, background: partyColor }}
                      />
                    </div>
                    <span className={styles.barRowValue}>{value.toLocaleString()}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
