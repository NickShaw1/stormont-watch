'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import styles from './partyDetail.module.css'
import { formatMemberName, formatConstituency } from '@/lib/format'
import MlaPhoto from '@/components/MlaPhoto'

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
  const router = useRouter()
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
    if (!hansardPartyRank) return 'var(--ink-3)'
    const pctile = hansardPartyRank.totalParties > 1
      ? (hansardPartyRank.rank - 1) / (hansardPartyRank.totalParties - 1)
      : 0
    return pctile <= 0.33 ? 'var(--forest)' : pctile <= 0.66 ? '#92400E' : 'var(--crimson)'
  })()

  const debatesRankColor = (() => {
    if (!hansardPartyDebateRank) return 'var(--ink-3)'
    const pctile = hansardPartyDebateRank.totalParties > 1
      ? (hansardPartyDebateRank.rank - 1) / (hansardPartyDebateRank.totalParties - 1)
      : 0
    return pctile <= 0.33 ? 'var(--forest)' : pctile <= 0.66 ? '#92400E' : 'var(--crimson)'
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

    let chart: import('chart.js').Chart | null = null

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
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#888780' } },
            y: { beginAtZero: true, ticks: { precision: 1, font: { size: 10 }, color: '#888780' }, grid: { color: 'rgba(136,135,128,0.15)' } },
          },
        },
      })
    })

    return () => { chart?.destroy() }
  }, [hansardSittingsByMonth, mlaCount, partyColor])

  return (
    <div className={styles.statsSection}>
      {/* Glance cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>AVG SITTINGS PER CURRENT MLA</div>
          <div className={styles.statValue}>
            {hansardPartyRank ? hansardPartyRank.avgSittings.toFixed(1) : '—'}
          </div>
          {hansardPartyRank && (
            <div className={styles.statSub} style={{ color: sittingsRankColor }}>
              Ranked {hansardPartyRank.rank}/{hansardPartyRank.totalParties}
            </div>
          )}
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>AVG DEBATES PER CURRENT MLA</div>
          <div className={styles.statValue}>
            {hansardPartyDebateRank ? hansardPartyDebateRank.avgDebates.toFixed(1) : '—'}
          </div>
          {hansardPartyDebateRank && (
            <div className={styles.statSub} style={{ color: debatesRankColor }}>
              Ranked {hansardPartyDebateRank.rank}/{hansardPartyDebateRank.totalParties}
            </div>
          )}
        </div>

        {parsedStats.length > 1 && <>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>SITTINGS</div>
            <div className={styles.statDivider} />
            {topBySittings && (
              <>
                <div className={styles.statMlaArrow} style={{ color: 'var(--forest)' }}>↑ Most</div>
                <Link href={`/assembly/mlas/${topBySittings.personId}`} className={styles.statMlaRow}>
                  <div className={styles.statMlaPhoto}>
                    <MlaPhoto name={topBySittings.fullName} imgUrl={topBySittings.imgUrl ?? ''} size={40} decorative square />
                  </div>
                  <div className={styles.statMlaInfo}>
                    <span className={styles.statMlaName}>{formatMemberName(topBySittings.fullName)}</span>
                    {topBySittings.constituency && (
                      <span className={styles.statMlaConstituency}>{formatConstituency(topBySittings.constituency)}</span>
                    )}
                  </div>
                  <div className={styles.statMlaValueCol}>
                    <span className={styles.statMlaPct}>{topBySittings.sittings}</span>
                    <span className={styles.statMlaCount}>sittings</span>
                  </div>
                </Link>
              </>
            )}
            {fewestBySittings && (
              <>
                <div className={styles.statMlaSep} />
                <div className={styles.statMlaArrow} style={{ color: 'var(--crimson)' }}>↓ Fewest</div>
                <Link href={`/assembly/mlas/${fewestBySittings.personId}`} className={styles.statMlaRow}>
                  <div className={styles.statMlaPhoto}>
                    <MlaPhoto name={fewestBySittings.fullName} imgUrl={fewestBySittings.imgUrl ?? ''} size={40} decorative square />
                  </div>
                  <div className={styles.statMlaInfo}>
                    <span className={styles.statMlaName}>{formatMemberName(fewestBySittings.fullName)}</span>
                    {fewestBySittings.constituency && (
                      <span className={styles.statMlaConstituency}>{formatConstituency(fewestBySittings.constituency)}</span>
                    )}
                  </div>
                  <div className={styles.statMlaValueCol}>
                    <span className={styles.statMlaPct}>{fewestBySittings.sittings}</span>
                    <span className={styles.statMlaCount}>sittings</span>
                  </div>
                </Link>
              </>
            )}
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>TOPICS SPOKEN ON</div>
            <div className={styles.statDivider} />
            {topByDebates && (
              <>
                <div className={styles.statMlaArrow} style={{ color: 'var(--forest)' }}>↑ Most</div>
                <Link href={`/assembly/mlas/${topByDebates.personId}`} className={styles.statMlaRow}>
                  <div className={styles.statMlaPhoto}>
                    <MlaPhoto name={topByDebates.fullName} imgUrl={topByDebates.imgUrl ?? ''} size={40} decorative square />
                  </div>
                  <div className={styles.statMlaInfo}>
                    <span className={styles.statMlaName}>{formatMemberName(topByDebates.fullName)}</span>
                    {topByDebates.constituency && (
                      <span className={styles.statMlaConstituency}>{formatConstituency(topByDebates.constituency)}</span>
                    )}
                  </div>
                  <div className={styles.statMlaValueCol}>
                    <span className={styles.statMlaPct}>{topByDebates.debates}</span>
                    <span className={styles.statMlaCount}>topics</span>
                  </div>
                </Link>
              </>
            )}
            {fewestByDebates && (
              <>
                <div className={styles.statMlaSep} />
                <div className={styles.statMlaArrow} style={{ color: 'var(--crimson)' }}>↓ Fewest</div>
                <Link href={`/assembly/mlas/${fewestByDebates.personId}`} className={styles.statMlaRow}>
                  <div className={styles.statMlaPhoto}>
                    <MlaPhoto name={fewestByDebates.fullName} imgUrl={fewestByDebates.imgUrl ?? ''} size={40} decorative square />
                  </div>
                  <div className={styles.statMlaInfo}>
                    <span className={styles.statMlaName}>{formatMemberName(fewestByDebates.fullName)}</span>
                    {fewestByDebates.constituency && (
                      <span className={styles.statMlaConstituency}>{formatConstituency(fewestByDebates.constituency)}</span>
                    )}
                  </div>
                  <div className={styles.statMlaValueCol}>
                    <span className={styles.statMlaPct}>{fewestByDebates.debates}</span>
                    <span className={styles.statMlaCount}>topics</span>
                  </div>
                </Link>
              </>
            )}
          </div>
        </>}
      </div>

      {/* Chart */}
      <div className={styles.statsSection} style={{ marginTop: '2rem' }}>
        <h3 className={styles.expensesSectionHeading} style={{ marginBottom: 'var(--s-2)' }}>Average Sittings <em>per MLA by Month</em></h3>
        <p style={{ fontSize: '15px', color: 'var(--ink-2)', margin: '0.25rem 0 0.75rem' }}>
          The average number of plenary sittings spoken in across all {party} MLAs, per month since May 2022.
        </p>
        <div style={{ height: 180, marginTop: '1rem' }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Ranking table */}
      {parsedStats.length > 1 && sorted.length > 0 && (
        <div style={{ marginTop: '2rem', paddingTop: 'var(--s-2)' }}>
          <h3 className={styles.expensesSectionHeading}>MLA Chamber <em>Activity</em></h3>
          <p style={{ fontSize: '15px', color: 'var(--ink-2)', marginBottom: '1rem' }}>
            Each <strong>current MLA&apos;s</strong> plenary sittings spoken in and topics contributed to since the mandate began in May 2022.
          </p>
          <div className="note-card" style={{ marginBottom: '1rem' }}>
            <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
              <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
              <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
            </svg>
            <p>Presiding officers are excluded from rankings. Their role is procedural rather than representative.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              className={`${styles.chamberFilterBtn} ${sortBy === 'sittings' ? styles.chamberFilterBtnActive : ''}`}
              onClick={() => setSortBy('sittings')}
            >
              Sittings
            </button>
            <button
              className={`${styles.chamberFilterBtn} ${sortBy === 'debates' ? styles.chamberFilterBtnActive : ''}`}
              onClick={() => setSortBy('debates')}
            >
              Topics
            </button>
          </div>
          <div className={styles.qRankWrap}>
            <table className={styles.qRankTable} aria-label="MLA chamber participation ranking">
              <colgroup>
                <col className={styles.qColRank} />
                <col className={styles.qColMla} />
                <col className={`${styles.qColConstituency} ${styles.qHideMobile}`} />
                <col className={styles.qColQuestions} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">MLA</th>
                  <th scope="col" className={styles.qHideMobile}>Constituency</th>
                  <th scope="col" className={styles.qThQuestions}>{sortBy === 'sittings' ? 'Sittings' : 'Topics'}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((mla, i) => {
                  const value = sortBy === 'sittings' ? mla.sittings : mla.debates
                  const barPct = maxValue > 0 ? Math.round(value / maxValue * 100) : 0
                  return (
                    <tr
                      key={mla.personId}
                      onClick={() => router.push(`/assembly/mlas/${mla.personId}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className={styles.qTdRank}>{i + 1}</td>
                      <td>
                        <div className={styles.qMlaCell}>
                          <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={36} decorative square />
                          <div className={styles.qMlaInfo}>
                            <Link href={`/assembly/mlas/${mla.personId}`} className={styles.qMlaName}>
                              {formatMemberName(mla.fullName)}
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td className={`${styles.qTdConstituency} ${styles.qHideMobile}`}>
                        {mla.constituency ? formatConstituency(mla.constituency) : '—'}
                      </td>
                      <td className={styles.qTdQuestions}>
                        <div className={styles.qQuestionsInner}>
                          <div className={styles.qBarTrack} aria-hidden="true">
                            <div
                              className={styles.qBarFill}
                              style={{ width: `${barPct}%`, background: partyColor }}
                            />
                          </div>
                          <span className={styles.qQuestionsValue}>{value.toLocaleString()}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
