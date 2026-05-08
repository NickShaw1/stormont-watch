'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import { partyBorderColor, abbreviateParty, formatMemberName, formatConstituency } from '@/lib/format'
import styles from './partyDetail.module.css'

const EXEC_ORDER: Record<string, number> = {
  'First Minister': 0,
  'deputy First Minister': 1,
  'junior Minister': 2,
}

type Minister = {
  personId: string
  fullName: string
  imgUrl: string | null
  roleTitle: string | null
  department: string | null
}

type Chair = {
  personId: string
  fullName: string
  imgUrl: string | null
  committeeName: string
}

type Mla = {
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
  assemblyRole?: string | null
  assemblyRoleEnd?: string | null
}

interface Props {
  party: string
  mlas: Mla[]
  ministers: Minister[]
  chairs: Chair[]
  borderColor: string
}

type QuestionStatRow = { personId: string; year: number; month: number; writtenCount: number; oralCount: number }

const tabs = ['stats', 'expenses', 'questions', 'chamber'] as const
type Tab = typeof tabs[number]

interface FullProps extends Props {
  description?: string
  wikiUrl?: string
  partyUrl?: string
  statsContent?: React.ReactNode
  expensesContent?: React.ReactNode
  chamberContent?: React.ReactNode
  totalQuestions?: number
  writtenCount?: number
  oralCount?: number
  questionStats?: QuestionStatRow[]
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

function QuestionsYearChart({ questionStats, partyColor }: { questionStats: QuestionStatRow[]; partyColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const yearTotals = new Map<number, number>()
    for (const r of questionStats) {
      yearTotals.set(r.year, (yearTotals.get(r.year) ?? 0) + r.writtenCount + r.oralCount)
    }
    const years = [...yearTotals.keys()].sort()
    const data = years.map(y => yearTotals.get(y) ?? 0)

    let chart: import('chart.js').Chart | null = null
    import('chart.js/auto').then(({ default: Chart }) => {
      if (!canvasRef.current) return
      const existing = Chart.getChart(canvasRef.current)
      if (existing) existing.destroy()
      chart = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: years.map(String),
          datasets: [{ data, backgroundColor: partyColor + '99', borderColor: partyColor, borderWidth: 1, borderRadius: 3 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
          },
        },
      })
    })
    return () => { chart?.destroy() }
  }, [questionStats, partyColor])

  return (
    <div style={{ height: 180, marginTop: '1rem' }}>
      <canvas ref={canvasRef} />
    </div>
  )
}

export default function PartyDetailClient({ party, mlas, ministers, chairs, borderColor, description, statsContent, expensesContent, chamberContent, totalQuestions = 0, writtenCount = 0, oralCount = 0, questionStats = [] }: FullProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stats')
  const router = useRouter()

  const execMinisters = ministers.filter((m) => m.department === 'The Executive Office')
  const deptMinisters = ministers.filter((m) => m.department !== 'The Executive Office')
  const sortedExec = [...execMinisters].sort(
    (a, b) => (EXEC_ORDER[a.roleTitle ?? ''] ?? 99) - (EXEC_ORDER[b.roleTitle ?? ''] ?? 99)
  )

  const abbr = abbreviateParty(party)

  const ministerIds = new Set(ministers.map(m => m.personId))
  const qTotals = new Map<string, number>()
  for (const r of questionStats) {
    qTotals.set(r.personId, (qTotals.get(r.personId) ?? 0) + r.writtenCount + r.oralCount)
  }
  const rankedMlaQuestions = mlas.length > 1
    ? mlas
        .filter(m => m.assemblyRole !== 'Speaker' && !ministerIds.has(m.personId))
        .map(m => ({ ...m, total: qTotals.get(m.personId) ?? 0 }))
        .filter(m => m.total > 0)
        .sort((a, b) => b.total - a.total)
    : []
  const qMaxTotal = rankedMlaQuestions[0]?.total ?? 1

  return (
    <>
      {/* Description — always visible above tabs */}
      {description && (
        <div className={styles.descriptionBlock}>
          <p className={styles.description}>{description}</p>
        </div>
      )}

      {/* Tab bar */}
      <div className={styles.tabSection}>
        <div className={styles.billTabs} role="tablist" aria-label="Party sections">
          {tabs.filter(tab => tab !== 'questions' || totalQuestions > 0).map((tab) => {
            const label = tab === 'stats' ? 'Attendance' : tab === 'expenses' ? 'Expenses' : tab === 'questions' ? 'Questions' : 'Chamber'
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`tabpanel-${tab}`}
                id={`tab-${tab}`}
                className={`${styles.billTabBtn} ${activeTab === tab ? styles.billTabBtnActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div
          id="tabpanel-stats"
          role="tabpanel"
          aria-labelledby="tab-stats"
          hidden={activeTab !== 'stats'}
          className={styles.tabContent}
        >
          {statsContent ?? (
            <p style={{ color: 'var(--ink-3)', padding: '2rem 0' }}>Assembly stats coming soon.</p>
          )}
        </div>
        <div
          id="tabpanel-expenses"
          role="tabpanel"
          aria-labelledby="tab-expenses"
          hidden={activeTab !== 'expenses'}
          className={styles.tabContent}
        >
          {expensesContent ?? (
            <p style={{ color: 'var(--ink-3)', padding: '2rem 0' }}>No expenses data available.</p>
          )}
        </div>
        <div
          id="tabpanel-chamber"
          role="tabpanel"
          aria-labelledby="tab-chamber"
          hidden={activeTab !== 'chamber'}
          className={styles.tabContent}
        >
          {chamberContent ?? (
            <p style={{ color: 'var(--ink-3)', padding: '2rem 0' }}>No chamber data available.</p>
          )}
        </div>
        {totalQuestions > 0 && (
          <div
            id="tabpanel-questions"
            role="tabpanel"
            aria-labelledby="tab-questions"
            hidden={activeTab !== 'questions'}
            className={styles.tabContent}
          >
            <div className={styles.questionsPanel}>
              <div className={styles.questionsCard}>
                <div className={styles.questionsSummary}>
                  <div className={styles.questionsSummaryCell}>
                    <span className={styles.questionsSummaryLabel}>Total questions</span>
                    <span className={styles.questionsSummaryValue}>{totalQuestions.toLocaleString()}</span>
                    <span className={styles.questionsSummaryMeta}>Since 2022</span>
                  </div>
                  <div className={styles.questionsSummaryCell}>
                    <span className={styles.questionsSummaryLabel}>Written</span>
                    <span className={styles.questionsSummaryValue}>{writtenCount.toLocaleString()}</span>
                    <span className={styles.questionsSummaryMeta}>{pct(writtenCount, totalQuestions)}% of total</span>
                  </div>
                  <div className={styles.questionsSummaryCell}>
                    <span className={styles.questionsSummaryLabel}>Oral</span>
                    <span className={styles.questionsSummaryValue}>{oralCount.toLocaleString()}</span>
                    <span className={styles.questionsSummaryMeta}>{pct(oralCount, totalQuestions)}% of total</span>
                  </div>
                </div>
              </div>
              <div className={styles.statsSection} style={{ marginTop: '2rem' }}>
                <h3 className={styles.expensesSectionHeading} style={{ marginBottom: 'var(--s-2)' }}>Questions <em>by Year</em></h3>
                <p style={{ fontSize: '15px', color: 'var(--ink-2)', margin: '0.25rem 0 0.75rem' }}>Total written and oral questions submitted to ministers each year since the mandate began in May 2022.</p>
                <QuestionsYearChart questionStats={questionStats} partyColor={borderColor} />
              </div>
            </div>

            {rankedMlaQuestions.length > 0 && (
              <div className={styles.qRankWrap}>
                <table className={styles.qRankTable} aria-label="MLA questions ranking">
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
                      <th scope="col" className={styles.qThQuestions}>Questions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedMlaQuestions.map((mla, i) => {
                      const barPct = qMaxTotal > 0 ? Math.round(mla.total / qMaxTotal * 100) : 0
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
                                  style={{ width: `${barPct}%`, background: borderColor }}
                                />
                              </div>
                              <span className={styles.qQuestionsValue}>{mla.total.toLocaleString()}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <hr className="section-rule" />

      {/* Executive Office */}
      {sortedExec.length > 0 && (
        <section className={styles.section} aria-labelledby="exec-heading">
          <h2 id="exec-heading" className={styles.sectionHeading}>Executive Office</h2>
          <div className={styles.execTop}>
            {sortedExec.map((m) => (
              <Link
                key={m.personId}
                href={`/assembly/mlas/${m.personId}`}
                className={styles.execCard}
                style={{ '--party-c': partyBorderColor(party) } as React.CSSProperties}
              >
                <div className={styles.execPhoto}>
                  <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={72} decorative square />
                </div>
                <div className={styles.execInfo}>
                  <span className={styles.execMinistry}>
                    {m.roleTitle ? m.roleTitle.charAt(0).toUpperCase() + m.roleTitle.slice(1) : ''}
                  </span>
                  <span className={styles.execName}>{formatMemberName(m.fullName)}</span>
                  <span className="party-pill" data-party={abbr}>{abbr}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Ministers */}
      {deptMinisters.length > 0 && (
        <section className={styles.section} aria-labelledby="ministers-heading">
          <h2 id="ministers-heading" className={styles.sectionHeading}>Ministers</h2>
          <div className={styles.deptGrid}>
            {deptMinisters.map((m) => (
              <div key={m.personId} className={styles.deptBlock}>
                <div className={styles.deptBlockHead}>
                  <span className={styles.deptName}>{m.department ?? ''}</span>
                </div>
                <Link href={`/assembly/mlas/${m.personId}`} className={styles.deptItem}>
                  <div className={styles.deptPhoto}>
                    <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={56} decorative square />
                  </div>
                  <div className={styles.deptInfo}>
                    <span className={styles.deptLabel}>Minister</span>
                    <span className={styles.deptMlaName}>{formatMemberName(m.fullName)}</span>
                    <span className="party-pill" data-party={abbr}>{abbr}</span>
                  </div>
                  <span className={styles.deptArrow}>→</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Committee Chairs */}
      {chairs.length > 0 && (
        <section className={styles.section} aria-labelledby="chairs-heading">
          <h2 id="chairs-heading" className={styles.sectionHeading}>Committee Chairs</h2>
          <div className={styles.deptGrid}>
            {chairs.map((c) => (
              <div key={c.personId} className={styles.deptBlock}>
                <div className={styles.deptBlockHead}>
                  <span className={styles.deptName}>{c.committeeName}</span>
                </div>
                <Link href={`/assembly/mlas/${c.personId}`} className={styles.deptItem}>
                  <div className={styles.deptPhoto}>
                    <MlaPhoto name={c.fullName} imgUrl={c.imgUrl ?? ''} size={56} decorative square />
                  </div>
                  <div className={styles.deptInfo}>
                    <span className={styles.deptLabel}>Chair</span>
                    <span className={styles.deptMlaName}>{formatMemberName(c.fullName)}</span>
                    <span className="party-pill" data-party={abbr}>{abbr}</span>
                  </div>
                  <span className={styles.deptArrow}>→</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MLAs */}
      <section className={styles.section} aria-labelledby="mlas-heading">
        <h2 id="mlas-heading" className={styles.sectionHeading}>
          MLAs <span className={styles.mlaCount}>{mlas.length}</span>
        </h2>
        <ul className={styles.mlaGrid} role="list">
          {mlas.map((mla) => (
            <li key={mla.personId} className={styles.mlaCardWrapper}>
              <div className={styles.mlaCard} style={{ '--party-c': borderColor } as React.CSSProperties}>

                <div className={styles.mlaPhoto}>
                  <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={64} decorative square />
                </div>
                <Link
                  href={`/assembly/mlas/${mla.personId}`}
                  className={styles.mlaName}
                  aria-label={`View profile for ${formatMemberName(mla.fullName)}`}
                >
                  {formatMemberName(mla.fullName)}
                </Link>
                <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
