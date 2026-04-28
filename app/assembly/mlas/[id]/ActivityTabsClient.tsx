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
}

const gbp = (val: string | null | undefined) =>
  val ? `£${parseFloat(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '£0.00'

function formatInterestDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

type Tab = 'questions' | 'finances' | 'interests'


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
        label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
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

export default function ActivityTabsClient(props: Props) {
  const { allExpenses, interests, totalQuestions, writtenCount, oralCount, questionStats, hideQuestionsTab, partyColor, questionRank, currentSalary, mandateEarnings, mandateExpensesRank, mandateExpensesTotalMembers } = props
  const [activeTab, setActiveTab] = useState<Tab>('finances')
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
        <button
          role="tab"
          id="tab-finances"
          aria-selected={activeTab === 'finances'}
          aria-controls="panel-finances"
          className={`${styles.financesTab} ${activeTab === 'finances' ? styles.financesTabActive : ''}`}
          onClick={() => setActiveTab('finances')}
        >
          Finances
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
        {!hideQuestionsTab && totalQuestions > 0 && (
          <button
            role="tab"
            id="tab-questions"
            aria-selected={activeTab === 'questions'}
            aria-controls="panel-questions"
            className={`${styles.financesTab} ${activeTab === 'questions' ? styles.financesTabActive : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            Questions
          </button>
        )}
      </div>

      {activeTab === 'questions' && !hideQuestionsTab && (
        <div id="panel-questions" role="tabpanel" aria-labelledby="tab-questions" className={styles.questionsPanel}>
          <div className={styles.questionsCard}>
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
            <div className={styles.questionsChartArea}>
              <QuestionsChart questionStats={questionStats} partyColor={partyColor} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'finances' && (
        <div id="panel-finances" role="tabpanel" aria-labelledby="tab-finances" className={styles.financesPanel}>
          <div className={styles.salaryPanel}>
            <h3 className={styles.financesSectionHeading}>Salary &amp; <em>earnings</em></h3>
            <p className={styles.salaryFootnote}>
              * Salary estimates are based on published Assembly rates and may not reflect all personal circumstances.
            </p>
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
            <p className={styles.interestsEmpty}>No expenses data available.</p>
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
