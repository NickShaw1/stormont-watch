'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './mlaDetail.module.css'
import type { RoleInterval } from '@/lib/salaries'

type ExpenseRow = {
  financial_year: string
  period: string
  constituency_office: string | null
  other_expenses: string | null
  allowances: string | null
  staff_costs: string | null
  total: string | null
  rank: number
  total_members: number
}

type Expenses = ExpenseRow | null

type Interest = {
  id: number
  personId: string
  registerCategoryId: string
  registerCategory: string
  registerEntry: string
  registerEntryStartDate: string | null
  updatedAt: string | null
}

type QuestionStat = {
  year: number
  month: number
  writtenCount: number
  oralCount: number
}

type HansardRow = {
  reportDocId: string
  plenaryDate: string
  debateTitle: string
}

interface Props {
  expenses: Expenses
  allExpenses: ExpenseRow[]
  interests: Interest[]
  totalQuestions: number
  writtenCount: number
  oralCount: number
  questionStats: QuestionStat[]
  hideQuestionsTab: boolean
  partyColor: string
  questionRank: { rank: number; totalEligible: number } | null
  currentSalary: number
  mandateEarnings: number
  roleIntervals: RoleInterval[]
  mandateExpensesRank: number | null
  mandateExpensesTotalMembers: number | null
  hansardRows: HansardRow[]
  hansardRank: { rank: number; eligibleCount: number } | null
  hansardDebateRank: { rank: number; eligibleCount: number; debates: number } | null
  hansardSittingsByMonth: { year: number; month: number; totalSittings: number }[]
}

const gbp = (val: string | null | undefined) =>
  val ? `£${parseFloat(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '£0.00'

function formatInterestDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

type Tab = 'questions' | 'finances' | 'interests' | 'speeches'


function gbpSalary(val: number): string {
  return `£${val.toLocaleString('en-GB')}`
}

function toSentenceCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

function QuestionsChart({ questionStats, partyColor }: { questionStats: QuestionStat[]; partyColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    const statMap = new Map(questionStats.map(r => [`${r.year}-${r.month}`, r.writtenCount + r.oralCount]))
    const data = months.map(m => statMap.get(`${m.year}-${m.month}`) ?? 0)
    const labels = months.map(m => m.label)

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
            y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 }, color: '#888780' }, grid: { color: 'rgba(136,135,128,0.15)' } },
          },
        },
      })
    })

    return () => { chart?.destroy() }
  }, [questionStats, partyColor])

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 'var(--spacing-sm)', marginTop: 0 }}>Questions asked by month</h3>
      <p style={{ fontSize: '15px', fontWeight: 400, fontStyle: 'normal', color: 'var(--ink-2)', marginBottom: '0.75rem', fontFamily: 'var(--font-sans)' }}>Total written and oral questions submitted to ministers each month over the last 12 months.</p>
      <div style={{ position: 'relative', width: '100%', height: 180 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

function SpeechesChart({ hansardRows, hansardSittingsByMonth, partyColor }: {
  hansardRows: HansardRow[]
  hansardSittingsByMonth: { year: number; month: number; totalSittings: number }[]
  partyColor: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    // Total sittings that month from DB
    const totalMap = new Map(hansardSittingsByMonth.map(r => [`${r.year}-${r.month}`, r.totalSittings]))

    // Distinct sittings spoken in per month from hansardRows
    const spokenMap = new Map<string, Set<string>>()
    for (const row of hansardRows) {
      const year = parseInt(row.plenaryDate.slice(0, 4))
      const month = parseInt(row.plenaryDate.slice(5, 7))
      const key = `${year}-${month}`
      if (!spokenMap.has(key)) spokenMap.set(key, new Set())
      spokenMap.get(key)!.add(row.reportDocId)
    }

    const totalData = months.map(m => totalMap.get(`${m.year}-${m.month}`) ?? 0)
    const spokenData = months.map(m => spokenMap.get(`${m.year}-${m.month}`)?.size ?? 0)
    const labels = months.map(m => m.label)

    let chart: import('chart.js').Chart | null = null

    import('chart.js/auto').then(({ default: Chart }) => {
      if (!canvasRef.current) return
      const existing = Chart.getChart(canvasRef.current)
      if (existing) existing.destroy()
      chart = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Total sittings that month',
              data: totalData,
              backgroundColor: '#E2E8F0',
              borderRadius: 3,
            },
            {
              label: 'Sittings spoken in',
              data: spokenData,
              backgroundColor: partyColor,
              borderRadius: 3,
            },
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
                label: (item) => {
                  if (item.datasetIndex === 0) return `Total sittings: ${item.raw}`
                  return `Sittings spoken in: ${item.raw}`
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#888780', maxRotation: 45, autoSkip: true, maxTicksLimit: 12 } },
            y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 }, color: '#888780', stepSize: 5 }, grid: { color: 'rgba(136,135,128,0.15)' } },
          },
        },
      })
    })

    return () => { chart?.destroy() }
  }, [hansardRows, hansardSittingsByMonth, partyColor])

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 'var(--spacing-sm)', marginTop: 0 }}>Plenary participation by month</h3>
      <p style={{ fontSize: '15px', fontWeight: 400, fontStyle: 'normal', color: 'var(--ink-2)', marginBottom: '0.75rem', fontFamily: 'var(--font-sans)' }}>How many plenary sittings this MLA spoke in each month, compared to the total sittings that month.</p>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '11px', color: 'var(--ink-3)' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#E2E8F0', border: '1px solid #cbd5e1' }} />
          Total sittings that month
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '11px', color: 'var(--ink-3)' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: partyColor }} />
          Sittings spoken in
        </span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: 180 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

export default function ActivityTabsClient(props: Props) {
  const { allExpenses, interests, totalQuestions, writtenCount, oralCount, questionStats, hideQuestionsTab, partyColor, questionRank, currentSalary, mandateEarnings, mandateExpensesRank, mandateExpensesTotalMembers, hansardRows, hansardRank, hansardDebateRank, hansardSittingsByMonth } = props
  const participationVisible = (!hideQuestionsTab && totalQuestions > 0) || hansardRows.length > 0
  const [activeTab, setActiveTab] = useState<Tab>(participationVisible ? 'questions' : 'finances')
  const [selectedYear, setSelectedYear] = useState<string>(allExpenses[0]?.financial_year ?? '')
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false)
  const yearDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!yearDropdownOpen) return
    function onOutside(e: MouseEvent) {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
        setYearDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [yearDropdownOpen])

  const selectedExpenses = allExpenses.find(e => e.financial_year === selectedYear) ?? null

  const mandateTotalExpenses = allExpenses.reduce((sum, e) => {
    return sum + (parseFloat(e.total ?? '0') || 0)
  }, 0)

  const grouped = interests.reduce<Record<string, Interest[]>>((acc, item) => {
    if (!acc[item.registerCategory]) acc[item.registerCategory] = []
    acc[item.registerCategory].push(item)
    return acc
  }, {})

  return (
    <div className={styles.financesCard}>
      <div className={styles.financesTabs} role="tablist" aria-label="Activity sections">
        {(!hideQuestionsTab && totalQuestions > 0) || hansardRows.length > 0 ? (
          <button
            role="tab"
            id="tab-participation"
            aria-selected={activeTab === 'questions' || activeTab === 'speeches'}
            aria-controls="panel-participation"
            className={`${styles.financesTab} ${(activeTab === 'questions' || activeTab === 'speeches') ? styles.financesTabActive : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            <span className={styles.tabLabelDesktop}>Participation</span>
            <span className={styles.tabLabelMobile} aria-hidden="true">Activity</span>
          </button>
        ) : null}
        <button
          role="tab"
          id="tab-finances"
          aria-selected={activeTab === 'finances'}
          aria-controls="panel-finances"
          className={`${styles.financesTab} ${activeTab === 'finances' ? styles.financesTabActive : ''}`}
          onClick={() => setActiveTab('finances')}
        >
          <span className={styles.tabLabelDesktop}>Finances</span>
          <span className={styles.tabLabelMobile} aria-hidden="true">Finances</span>
        </button>
        <button
          role="tab"
          id="tab-interests"
          aria-selected={activeTab === 'interests'}
          aria-controls="panel-interests"
          className={`${styles.financesTab} ${activeTab === 'interests' ? styles.financesTabActive : ''}`}
          onClick={() => setActiveTab('interests')}
        >
          <span className={styles.tabLabelDesktop}>Register of Interests</span>
          <span className={styles.tabLabelMobile} aria-hidden="true">Interests</span>
        </button>
      </div>

      {(activeTab === 'questions' || activeTab === 'speeches') && (
        <div id="panel-participation" role="tabpanel" aria-labelledby="tab-participation" className={styles.questionsPanel}>

          {!hideQuestionsTab && totalQuestions > 0 && (
            <>
              <h3 className={styles.financesSectionHeading}>Questions to <em>Ministers</em></h3>
              <p className={styles.salaryFootnote} style={{ fontSize: '15px', color: 'var(--ink-2)', fontStyle: 'normal', marginBottom: 0 }}>Written and oral questions formally submitted to ministers since mandate start.</p>
              <div className="note-card" style={{ marginTop: 'var(--spacing-md)', marginBottom: 0 }}>
                <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
                  <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
                  <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
                </svg>
                <p>Rankings exclude current ministers and the Speaker.</p>
              </div>
              <div className={styles.questionsCard} style={{ marginTop: 'var(--spacing-md)' }}>
                <div className={styles.questionsSummary}>
                  <div className={styles.questionsSummaryCell}>
                    <span className={styles.questionsSummaryLabel}>Total questions</span>
                    <span className={styles.questionsSummaryValue}>{totalQuestions.toLocaleString()}</span>
                    {questionRank && (() => {
                      const { rank, totalEligible } = questionRank
                      const pctile = totalEligible > 1 ? (rank - 1) / (totalEligible - 1) : 0
                      const color = pctile <= 0.33 ? 'var(--forest)' : pctile <= 0.66 ? '#92400E' : 'var(--crimson)'
                      return <span className={styles.questionsSummaryMeta} style={{ color }}>Ranked {rank}/{totalEligible}</span>
                    })()}
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
              <QuestionsChart questionStats={questionStats} partyColor={partyColor} />
            </>
          )}

          {hansardRows.length > 0 && (() => {
            const distinctSittings = new Set(hansardRows.map(r => r.reportDocId)).size
            const distinctDebates = new Set(hansardRows.map(r => r.debateTitle)).size
            const recentFive = hansardRows.slice(0, 5)
            return (
              <>
                <h3 className={styles.financesSectionHeading} style={{ marginTop: (!hideQuestionsTab && totalQuestions > 0) ? 'var(--spacing-xl)' : undefined }}>Plenary <em>Participation</em></h3>
                <p className={styles.salaryFootnote} style={{ fontSize: '15px', color: 'var(--ink-2)', fontStyle: 'normal', marginBottom: 0 }}>Sittings and debates this MLA has spoken in during plenary sessions since mandate start.</p>
                <div className="note-card" style={{ marginTop: 'var(--spacing-md)', marginBottom: 0 }}>
                  <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
                    <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
                    <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
                  </svg>
                  <p>Rankings exclude presiding officers only. Ministers are included as they participate in plenary debates in their capacity as MLAs.</p>
                </div>
                <div className={styles.questionsCard} style={{ marginTop: 'var(--spacing-md)' }}>
                  <div className={styles.questionsSummary}>
                    <div className={styles.questionsSummaryCell}>
                      <span className={styles.questionsSummaryLabel}>Sittings</span>
                      <span className={styles.questionsSummaryValue}>{distinctSittings.toLocaleString()}/{hansardSittingsByMonth.reduce((acc, row) => acc + Number(row.totalSittings), 0).toLocaleString()}</span>
                      {hansardRank && (() => {
                        const { rank, eligibleCount } = hansardRank
                        const pctile = eligibleCount > 1 ? (rank - 1) / (eligibleCount - 1) : 0
                        const color = pctile <= 0.33 ? 'var(--forest)' : pctile <= 0.66 ? '#92400E' : 'var(--crimson)'
                        return <span className={styles.questionsSummaryMeta} style={{ color }}>Ranked {rank}/{eligibleCount}</span>
                      })()}
                      {!hansardRank && <span className={styles.questionsSummarySubtitle}>spoken in this mandate</span>}
                    </div>
                    <div className={styles.questionsSummaryCell}>
                      <span className={styles.questionsSummaryLabel}>Debates Contributed To</span>
                      <span className={styles.questionsSummaryValue}>{distinctDebates.toLocaleString()}</span>
                      {hansardDebateRank && (() => {
                        const { rank, eligibleCount } = hansardDebateRank
                        const pctile = eligibleCount > 1 ? (rank - 1) / (eligibleCount - 1) : 0
                        const color = pctile <= 0.33 ? 'var(--forest)' : pctile <= 0.66 ? '#92400E' : 'var(--crimson)'
                        return <span className={styles.questionsSummaryMeta} style={{ color }}>Ranked {rank}/{eligibleCount}</span>
                      })()}
                      {!hansardDebateRank && <span className={styles.questionsSummarySubtitle}>times spoken in the chamber</span>}
                    </div>
                    {(() => {
                      const monthMap = new Map<string, Set<string>>()
                      for (const row of hansardRows) {
                        const d = new Date(row.plenaryDate)
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                        if (!monthMap.has(key)) monthMap.set(key, new Set())
                        monthMap.get(key)!.add(row.reportDocId)
                      }
                      let bestKey = ''
                      let bestCount = 0
                      for (const [key, ids] of monthMap) {
                        if (ids.size > bestCount || (ids.size === bestCount && key > bestKey)) {
                          bestKey = key
                          bestCount = ids.size
                        }
                      }
                      if (!bestKey) return null
                      const [year, month] = bestKey.split('-').map(Number)
                      const label = new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                      return (
                        <div className={styles.questionsSummaryCell}>
                          <span className={styles.questionsSummaryLabel}>Most Active Month</span>
                          <span className={styles.questionsSummaryValue}>{label}</span>
                          <span className={styles.questionsSummarySubtitle}>{bestCount} sittings spoken in</span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
                <SpeechesChart hansardRows={hansardRows} hansardSittingsByMonth={hansardSittingsByMonth} partyColor={partyColor} />
                <h3 className={styles.financesSectionHeading} style={{ marginTop: 'var(--spacing-xl)', marginBottom: 'var(--spacing-md)' }}>Recent <em>Activity</em></h3>

                <div className={styles.speechDebateWrap}>
                  <ul className={styles.speechDebateList}>
                    {recentFive.map((row, i) => (
                      <li key={i} className={styles.speechDebateRow}>
                        <a
                          href={`https://aims.niassembly.gov.uk/officialreport/report.aspx?&eveDate=${row.plenaryDate}&docID=${row.reportDocId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.speechDebateLink}
                        >
                          <span className={styles.speechDebateTitle}>{row.debateTitle}</span>
                          <span className={styles.speechDebateDate}>
                            {new Date(row.plenaryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )
          })()}

        </div>
      )}

      {activeTab === 'finances' && (
        <div id="panel-finances" role="tabpanel" aria-labelledby="tab-finances" className={styles.financesPanel}>
          <div className={styles.salaryPanel}>
            <h3 className={styles.financesSectionHeading}>Salary &amp; <em>earnings</em></h3>
            <p className={styles.salaryNotice}>Salary estimates are based on published Assembly rates and may not reflect all personal circumstances.</p>
            <div className={styles.salaryCards}>
              <div className={styles.salaryCard}>
                <span className={styles.questionsSummaryLabel}>Current annual salary</span>
                <span className={styles.questionsSummaryValue}>{gbpSalary(currentSalary)}</span>
              </div>
              <div className={styles.salaryCard}>
                <span className={styles.questionsSummaryLabel}>Estimated mandate earnings</span>
                <span className={styles.questionsSummaryValue}>{gbpSalary(mandateEarnings)}</span>
              </div>
              <div className={styles.salaryCard}>
                <span className={styles.questionsSummaryLabel}>Mandate</span>
                <span className={styles.questionsSummaryValue}>2022–2027</span>
              </div>
            </div>
          </div>

          {allExpenses.length > 0 ? (
            <>
<h3 className={styles.financesSectionHeading} style={{ marginTop: 'var(--spacing-xl)', marginBottom: 'var(--s-4)' }}>Office <em>expenses</em></h3>

              <div className={styles.salaryCards}>
                <div className={styles.salaryCard}>
                  <span className={styles.questionsSummaryLabel}>Total mandate expenses</span>
                  <span className={styles.questionsSummaryValue}>{gbp(mandateTotalExpenses.toFixed(2))}</span>
                </div>
                <div className={styles.salaryCard}>
                  <span className={styles.questionsSummaryLabel}>{(selectedExpenses?.period ?? selectedYear).replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, m => m.slice(0, 3))} expenses rank</span>
                  <span className={styles.questionsSummaryValue}>
                    {selectedExpenses ? (() => {
                      const pctile = selectedExpenses.total_members > 1 ? (selectedExpenses.rank - 1) / (selectedExpenses.total_members - 1) : 0
                      const color = pctile <= 0.33 ? 'var(--crimson)' : pctile <= 0.66 ? '#92400E' : 'var(--forest)'
                      return <span style={{ color }}>{selectedExpenses.rank}<span className={styles.expenseFraction}>/{selectedExpenses.total_members}</span></span>
                    })() : <span className={styles.statMuted}>—</span>}
                  </span>
                </div>
                <div className={styles.salaryCard}>
                  <span className={styles.questionsSummaryLabel}>Overall mandate expenses rank</span>
                  <span className={styles.questionsSummaryValue}>
                    {mandateExpensesRank !== null && mandateExpensesTotalMembers !== null ? (() => {
                      const pctile = mandateExpensesTotalMembers > 1 ? (mandateExpensesRank - 1) / (mandateExpensesTotalMembers - 1) : 0
                      const color = pctile <= 0.33 ? 'var(--crimson)' : pctile <= 0.66 ? '#92400E' : 'var(--forest)'
                      return <span style={{ color }}>{mandateExpensesRank}<span className={styles.expenseFraction}>/{mandateExpensesTotalMembers}</span></span>
                    })() : <span className={styles.statMuted}>—</span>}
                  </span>
                </div>
              </div>

              {allExpenses.length > 1 && (
                <div className={styles.expensesYearDropdownWrap} ref={yearDropdownRef}>
                  <button
                    className={styles.expensesYearTrigger}
                    onClick={() => setYearDropdownOpen(o => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={yearDropdownOpen}
                    aria-label={`Select financial year, currently ${selectedYear}`}
                  >
                    <span>{selectedYear}</span>
                    <svg
                      className={`${styles.expensesYearChevron} ${yearDropdownOpen ? styles.expensesYearChevronOpen : ''}`}
                      width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
                    >
                      <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {yearDropdownOpen && (
                    <ul className={styles.expensesYearDropdownList} role="listbox">
                      {allExpenses.map(e => (
                        <li
                          key={e.financial_year}
                          role="option"
                          aria-selected={e.financial_year === selectedYear}
                          className={`${styles.expensesYearDropdownItem} ${e.financial_year === selectedYear ? styles.expensesYearDropdownItemSelected : ''}`}
                          onClick={() => { setSelectedYear(e.financial_year); setYearDropdownOpen(false) }}
                        >
                          {e.financial_year}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {selectedExpenses && (
                <div className={styles.expensesPanel} style={{ marginTop: allExpenses.length <= 1 ? 'var(--s-6)' : undefined }}>
                  <div className={styles.expensesGrid}>
                    <div className={styles.expensesCard}>
                      <span className={styles.expenseLabel}>Staff costs</span>
                      <span className={styles.expenseValue}>{gbp(selectedExpenses.staff_costs)}</span>
                    </div>
                    <div className={styles.expensesCard}>
                      <span className={styles.expenseLabel}>Constituency office</span>
                      <span className={styles.expenseValue}>{gbp(selectedExpenses.constituency_office)}</span>
                    </div>
                    <div className={styles.expensesCard}>
                      <span className={styles.expenseLabel}>Allowances</span>
                      <span className={styles.expenseValue}>{gbp(selectedExpenses.allowances)}</span>
                    </div>
                    <div className={styles.expensesCard}>
                      <span className={styles.expenseLabel}>Other expenses</span>
                      <span className={styles.expenseValue}>{gbp(selectedExpenses.other_expenses)}</span>
                    </div>
                    <div className={styles.expensesCard}>
                      <span className={styles.expenseLabel}>Total</span>
                      <span className={styles.expenseValue}>{gbp(selectedExpenses.total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className={styles.financesSectionHeading} style={{ marginTop: 'var(--spacing-xl)', marginBottom: 'var(--s-4)' }}>Office <em>expenses</em></h3>
              <p className={styles.interestsEmpty}>No expenses data available.</p>
            </>
          )}
        </div>
      )}

      {activeTab === 'interests' && (
        <div id="panel-interests" role="tabpanel" aria-labelledby="tab-interests" className={styles.interestsSection}>
          {interests.length === 0 ? (
            <p className={styles.interestsEmpty}>No interests currently registered.</p>
          ) : (
            Object.entries(grouped).map(([category, entries]) => (
              <div key={category} className={styles.interestCategory}>
                <h3 className={styles.interestCategoryHeading}>
                  {(() => {
                    const words = toSentenceCase(category).split(' ')
                    const last = words.pop()
                    return words.length ? <>{words.join(' ')} <em>{last}</em></> : <em>{last}</em>
                  })()}
                </h3>
                <ul className={styles.interestList}>
                  {entries.map((entry) => (
                    <li key={entry.id} className={styles.interestItem}>
                      <span className={styles.interestEntry}>{entry.registerEntry}</span>
                      {entry.registerEntryStartDate && (
                        <span className={styles.interestDate}>{formatInterestDate(entry.registerEntryStartDate)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          <p className={styles.interestsAttribution}>
            <span className={styles.tabLabelDesktop}>Data from the{' '}
              <a href="https://www.niassembly.gov.uk/your-mlas/register-of-interests/" target="_blank" rel="noopener noreferrer">
                NI Assembly Register of Members&apos; Interests
              </a>.
            </span>
            <span className={styles.tabLabelMobile}>Data from{' '}
              <a href="https://www.niassembly.gov.uk/your-mlas/register-of-interests/" target="_blank" rel="noopener noreferrer">
                NI Assembly
              </a>.
            </span>
          </p>
        </div>
      )}

    </div>
  )
}
