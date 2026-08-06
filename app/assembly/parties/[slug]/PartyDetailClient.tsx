'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Landmark, Users, Gavel, ShieldCheck, MessageCircleQuestion, FileText, Mic, TrendingUp } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import { abbreviateParty, formatMemberName, formatConstituency } from '@/lib/format'
import styles from './partyDetail.module.css'
import { useMandate } from '@/components/MandateContext'
import { useDropdown } from '@/lib/useDropdown'

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
  attendancePct?: number | null
}

interface Props {
  party: string
  mlas: Mla[]
  ministers: Minister[]
  chairs: Chair[]
  borderColor: string
}

type QuestionStatRow = { personId: string; year: number; month: number; writtenCount: number; oralCount: number }

const tabs = ['members', 'stats', 'expenses', 'questions', 'chamber'] as const
type Tab = typeof tabs[number]

const TAB_LABELS: Record<Tab, string> = {
  members: 'Members',
  stats: 'Attendance',
  expenses: 'Expenses',
  questions: 'Questions',
  chamber: 'Chamber',
}

function abbreviateRole(role: string): string {
  return role.replace(/\bPrincipal\b/g, 'Pr.')
}

type QuestionRankingRow = {
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
  isCurrent: boolean
  total: number
}

interface FullProps extends Props {
  statsContent?: React.ReactNode
  expensesContent?: React.ReactNode
  chamberContent?: React.ReactNode
  totalQuestions?: number
  writtenCount?: number
  oralCount?: number
  questionStats?: QuestionStatRow[]
  questionRanking?: QuestionRankingRow[]
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

    const root = getComputedStyle(document.documentElement)
    const tickColor = root.getPropertyValue('--sw-text-tertiary').trim() || '#656b72'
    const gridColor = root.getPropertyValue('--sw-border').trim() || '#dcded9'

    let chart: { destroy: () => void } | null = null
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
            x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 11 } } },
            y: { beginAtZero: true, ticks: { color: tickColor, precision: 0, font: { size: 11 } }, grid: { color: gridColor } },
          },
        },
      })
    })
    return () => { chart?.destroy() }
  }, [questionStats, partyColor])

  return (
    <div className={styles.chartAreaSm}>
      <canvas ref={canvasRef} />
    </div>
  )
}

export default function PartyDetailClient({ party, mlas, ministers, chairs, borderColor, statsContent, expensesContent, chamberContent, totalQuestions = 0, writtenCount = 0, oralCount = 0, questionStats = [], questionRanking = [] }: FullProps) {
  const [activeTab, setActiveTab] = useState<Tab>('members')
  const { mandate, basePath } = useMandate()
  const tabDropdown = useDropdown()

  const execMinisters = ministers.filter((m) => m.department === 'The Executive Office')
  const deptMinisters = ministers.filter((m) => m.department !== 'The Executive Office')
  const sortedExec = [...execMinisters].sort(
    (a, b) => (EXEC_ORDER[a.roleTitle ?? ''] ?? 99) - (EXEC_ORDER[b.roleTitle ?? ''] ?? 99)
  )

  const abbr = abbreviateParty(party)

  // Same "role badge" concept as the MLA search page's roleLookup.
  const roleLookup: Record<string, string> = {}
  for (const m of ministers) {
    if (m.roleTitle) roleLookup[m.personId] = m.roleTitle.charAt(0).toUpperCase() + m.roleTitle.slice(1)
  }
  for (const c of chairs) {
    roleLookup[c.personId] = 'Chair'
  }

  const rankedMlaQuestions = questionRanking
  const qMaxTotal = rankedMlaQuestions[0]?.total ?? 1

  return (
    <>
      {/* Tab bar */}
      <div className={styles.tabSection}>
        <div className={styles.tabPanel}>
          {(() => {
            const visibleTabs = tabs.filter(tab => tab !== 'questions' || totalQuestions > 0)
            return (
              <>
                <div className={styles.tabStrip} role="tablist" aria-label="Party sections">
                  {visibleTabs.map((tab) => (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={activeTab === tab}
                      aria-controls={`tabpanel-${tab}`}
                      id={`tab-${tab}`}
                      className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {TAB_LABELS[tab]}
                    </button>
                  ))}
                </div>

                <div className={styles.tabDropdownWrap}>
                  <div className={styles.dropdownWrap} ref={tabDropdown.wrapRef}>
                    <button
                      ref={tabDropdown.triggerRef}
                      type="button"
                      className={styles.dropdownTrigger}
                      onClick={() => tabDropdown.setOpen((o) => !o)}
                      aria-haspopup="listbox"
                      aria-expanded={tabDropdown.open}
                    >
                      {TAB_LABELS[activeTab]}
                      <svg
                        className={`${styles.dropdownTriggerChevron} ${tabDropdown.open ? styles.dropdownTriggerChevronOpen : ''}`}
                        width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
                      >
                        <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>

                    {tabDropdown.open && (
                      <ul ref={tabDropdown.listRef} className={styles.dropdownList} role="listbox">
                        {visibleTabs.map((tab) => (
                          <li
                            key={tab}
                            role="option"
                            tabIndex={0}
                            aria-selected={tab === activeTab}
                            className={`${styles.dropdownItem} ${tab === activeTab ? styles.dropdownItemSelected : ''}`}
                            onClick={() => { setActiveTab(tab); tabDropdown.setOpen(false) }}
                            onKeyDown={(e) => tabDropdown.handleKeyDown(e, () => { setActiveTab(tab); tabDropdown.setOpen(false) })}
                          >
                            {TAB_LABELS[tab]}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )
          })()}

          <div
            id="tabpanel-members"
            role="tabpanel"
            aria-labelledby="tab-members"
            hidden={activeTab !== 'members'}
            className={styles.tabContent}
          >
            {/* Executive Office */}
            {sortedExec.length > 0 && (
              <section className={`${styles.section} ${styles.sectionFirst}`} aria-labelledby="exec-heading">
                <div className={styles.sectionHead}>
                  <span className={styles.sectionEyebrow}>Power sharing</span>
                  <h2 id="exec-heading" className={styles.sectionHeading}>
                    <Landmark className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                    Executive Office
                  </h2>
                </div>
                <div className={styles.execTop}>
                  {sortedExec.map((m) => (
                    <Link
                      key={m.personId}
                      href={`${basePath}/assembly/mlas/${m.personId}`}
                      className={styles.execCard}
                    >
                      <div className={styles.execMain}>
                        <div className={styles.execPhoto}>
                          <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={72} decorative square personId={m.personId} />
                        </div>
                        <div className={styles.execInfo}>
                          <span className={styles.execRole}>
                            {m.roleTitle ? m.roleTitle.charAt(0).toUpperCase() + m.roleTitle.slice(1) : ''}
                          </span>
                          <span className={styles.execName}>{formatMemberName(m.fullName)}</span>
                        </div>
                      </div>
                      <span className="party-pill" data-party={abbr}>{abbr}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Ministers */}
            {deptMinisters.length > 0 && (
              <section className={`${styles.section} ${sortedExec.length === 0 ? styles.sectionFirst : ''}`} aria-labelledby="ministers-heading">
                <div className={styles.sectionHead}>
                  <span className={styles.sectionEyebrow}>Assembly business</span>
                  <h2 id="ministers-heading" className={styles.sectionHeading}>
                    <Gavel className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                    Ministers
                  </h2>
                </div>
                <div className={styles.deptGrid}>
                  {deptMinisters.map((m) => (
                    <div key={m.personId} className={styles.deptBlock}>
                      <div className={styles.deptBlockHead}>
                        <span className={styles.deptName}>{m.department ?? ''}</span>
                      </div>
                      <Link href={`${basePath}/assembly/mlas/${m.personId}`} className={styles.deptItem}>
                        <div className={styles.deptMain}>
                          <div className={styles.deptPhoto}>
                            <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={56} decorative square personId={m.personId} />
                          </div>
                          <div className={styles.deptInfo}>
                            <span className={styles.deptLabel}>Minister</span>
                            <span className={styles.deptMlaName}>{formatMemberName(m.fullName)}</span>
                          </div>
                        </div>
                        <span className="party-pill" data-party={abbr}>{abbr}</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Committee Chairs */}
            {chairs.length > 0 && (
              <section className={`${styles.section} ${sortedExec.length === 0 && deptMinisters.length === 0 ? styles.sectionFirst : ''}`} aria-labelledby="chairs-heading">
                <div className={styles.sectionHead}>
                  <span className={styles.sectionEyebrow}>Scrutiny</span>
                  <h2 id="chairs-heading" className={styles.sectionHeading}>
                    <ShieldCheck className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                    Committee Chairs
                  </h2>
                </div>
                <div className={styles.deptGrid}>
                  {chairs.map((c) => (
                    <div key={c.personId} className={styles.deptBlock}>
                      <div className={styles.deptBlockHead}>
                        <span className={styles.deptName}>{c.committeeName}</span>
                      </div>
                      <Link href={`${basePath}/assembly/mlas/${c.personId}`} className={styles.deptItem}>
                        <div className={styles.deptMain}>
                          <div className={styles.deptPhoto}>
                            <MlaPhoto name={c.fullName} imgUrl={c.imgUrl ?? ''} size={56} decorative square personId={c.personId} />
                          </div>
                          <div className={styles.deptInfo}>
                            <span className={styles.deptLabel}>Chair</span>
                            <span className={styles.deptMlaName}>{formatMemberName(c.fullName)}</span>
                          </div>
                        </div>
                        <span className="party-pill" data-party={abbr}>{abbr}</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* MLAs */}
            <section
              className={`${styles.section} ${sortedExec.length === 0 && deptMinisters.length === 0 && chairs.length === 0 ? styles.sectionFirst : ''}`}
              aria-labelledby="mlas-heading"
            >
              <div className={styles.sectionHead}>
                <span className={styles.sectionEyebrow}>Full roster</span>
                <h2 id="mlas-heading" className={styles.sectionHeading}>
                  <Users className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                  MLAs <span className={styles.mlaCount}>{mlas.length}</span>
                </h2>
              </div>
              <ul className={styles.mlaGrid} role="list">
                {mlas.map((mla) => {
                  const badgeLabel = mla.assemblyRole && !mla.assemblyRoleEnd
                    ? abbreviateRole(mla.assemblyRole)
                    : roleLookup[mla.personId]
                  const isPresidingOfficer = mla.assemblyRole === 'Speaker' && !mla.assemblyRoleEnd
                  return (
                    <li key={mla.personId}>
                      <div className={styles.mlaCard}>
                        <div className={styles.mlaMain}>
                          <div className={styles.mlaPhoto}>
                            <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={56} decorative square personId={mla.personId} />
                          </div>
                          <div className={styles.mlaInfo}>
                            <Link
                              href={`${basePath}/assembly/mlas/${mla.personId}`}
                              className={styles.mlaName}
                              aria-label={`View profile for ${formatMemberName(mla.fullName)}`}
                            >
                              {formatMemberName(mla.fullName)}
                            </Link>
                            <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
                            <span className={`${styles.mlaAtt} ${styles.mlaAttRow}`}>
                              Att. <strong>{isPresidingOfficer ? 'n/a' : (mla.attendancePct ?? 'n/a')}%</strong>
                            </span>
                          </div>
                        </div>
                        <div className={styles.mlaFoot}>
                          <span className="party-pill" data-party={abbr}>{abbr}</span>
                          {badgeLabel && (
                            <span className={styles.roleBadge}>{badgeLabel}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>

          <div
            id="tabpanel-stats"
            role="tabpanel"
            aria-labelledby="tab-stats"
            hidden={activeTab !== 'stats'}
            className={styles.tabContent}
          >
            {statsContent ?? (
              <p className={styles.sectionNote}>Assembly stats coming soon.</p>
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
              <p className={styles.sectionNote}>No expenses data available.</p>
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
              <p className={styles.sectionNote}>No chamber data available.</p>
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
              <div className={styles.statStrip}>
                <div className={styles.statCard}>
                  <div className={styles.statCardLabelRow}>
                    <span className={styles.statCardLabel}>Total questions</span>
                    <MessageCircleQuestion className={styles.statCardIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <span className={styles.statCardValue}>{totalQuestions.toLocaleString()}</span>
                  <span className={styles.statCardSub}>Since {mandate.start.slice(0, 4)}</span>
                </div>
                <div className={styles.statCard} data-tone="amber">
                  <div className={styles.statCardLabelRow}>
                    <span className={styles.statCardLabel}>Written</span>
                    <FileText className={styles.statCardIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <span className={styles.statCardValue}>{writtenCount.toLocaleString()}</span>
                  <span className={styles.statCardSub}>{pct(writtenCount, totalQuestions)}% of total</span>
                </div>
                <div className={styles.statCard} data-tone="neutral">
                  <div className={styles.statCardLabelRow}>
                    <span className={styles.statCardLabel}>Oral</span>
                    <Mic className={styles.statCardIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <span className={styles.statCardValue}>{oralCount.toLocaleString()}</span>
                  <span className={styles.statCardSub}>{pct(oralCount, totalQuestions)}% of total</span>
                </div>
              </div>

              <div className={`${styles.sectionHead} ${styles.sectionHeadSpaced} ${styles.sectionHeadWithSubtitle}`}>
                <span className={styles.sectionEyebrow}>By year</span>
                <h3 className={styles.sectionHeading}>
                  <MessageCircleQuestion className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                  Questions by year
                </h3>
                <p className={styles.sectionSubtitle}>Total written and oral questions submitted to ministers each year since the mandate began in {mandate.startLabel}.</p>
              </div>
              <QuestionsYearChart questionStats={questionStats} partyColor={borderColor} />

              {rankedMlaQuestions.length > 0 && (
                <>
                  <div className={`${styles.sectionHead} ${styles.sectionHeadSpaced}`}>
                    <span className={styles.sectionEyebrow}>Rankings</span>
                    <h3 className={styles.sectionHeading}>
                      <TrendingUp className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                      MLA questions ranking
                    </h3>
                  </div>
                  <div className={styles.barRowList}>
                    {rankedMlaQuestions.map((mla, i) => {
                      const barPct = qMaxTotal > 0 ? Math.round(mla.total / qMaxTotal * 100) : 0
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
                            {!mla.isCurrent && (
                              <span className={styles.formerPill}>Former MLA</span>
                            )}
                          </div>
                          <div className={styles.barRowBarWrap}>
                            <div className={styles.barRowTrack} aria-hidden="true">
                              <div
                                className={styles.barRowFill}
                                style={{ width: `${barPct}%`, background: borderColor }}
                              />
                            </div>
                            <span className={styles.barRowValue}>{mla.total.toLocaleString()}</span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

    </>
  )
}
