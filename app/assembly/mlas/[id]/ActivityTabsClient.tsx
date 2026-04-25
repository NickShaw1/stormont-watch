'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './mlaDetail.module.css'

type Expenses = {
  financial_year: string
  period: string
  constituency_office: string | null
  other_expenses: string | null
  allowances: string | null
  staff_costs: string | null
  total: string | null
  rank: number
  total_members: number
} | null

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
  interests: Interest[]
  totalQuestions: number
  writtenCount: number
  oralCount: number
  questionStats: QuestionStat[]
  hideQuestionsTab: boolean
  partyColor: string
  questionRank: { rank: number; totalEligible: number } | null
}

const gbp = (val: string | null | undefined) =>
  val ? `£${parseFloat(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '£0.00'

function formatInterestDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

type Tab = 'expenses' | 'interests' | 'questions'

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

export default function ActivityTabsClient({ expenses: latestExpenses, interests, totalQuestions, writtenCount, oralCount, questionStats, hideQuestionsTab, partyColor, questionRank }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('expenses')

  const grouped = interests.reduce<Record<string, Interest[]>>((acc, item) => {
    if (!acc[item.registerCategory]) acc[item.registerCategory] = []
    acc[item.registerCategory].push(item)
    return acc
  }, {})

  return (
    <div className={styles.financesCard}>
      <div className={styles.financesTabs} role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'expenses'}
          className={`${styles.financesTab} ${activeTab === 'expenses' ? styles.financesTabActive : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          Expenses
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'interests'}
          className={`${styles.financesTab} ${activeTab === 'interests' ? styles.financesTabActive : ''}`}
          onClick={() => setActiveTab('interests')}
        >
          <span className={styles.tabLabelDesktop}>Register of Interests</span>
          <span className={styles.tabLabelMobile}>Interests</span>
        </button>
        {!hideQuestionsTab && totalQuestions > 0 && (
          <button
            role="tab"
            aria-selected={activeTab === 'questions'}
            className={`${styles.financesTab} ${activeTab === 'questions' ? styles.financesTabActive : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            Questions
          </button>
        )}
      </div>

      {activeTab === 'questions' && !hideQuestionsTab && (
        <div className={styles.questionsPanel}>
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

      {activeTab === 'expenses' && latestExpenses && (
        <div className={styles.expensesPanel}>
          <div className={styles.expensesGrid}>
            <div className={styles.expensesCardHeader}>
              <p className={styles.sectionMeta}>
                {(() => {
                  const sep = latestExpenses.period.includes(' – ') ? ' – ' : ' - '
                  const [first, ...rest] = latestExpenses.period.split(sep)
                  return rest.length ? <>{first} –{' '}<em>{rest.join(sep)}</em></> : latestExpenses.period
                })()}
              </p>
            </div>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Staff costs</span>
              <span className={styles.expenseValue}>{gbp(latestExpenses.staff_costs)}</span>
            </div>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Constituency office</span>
              <span className={styles.expenseValue}>{gbp(latestExpenses.constituency_office)}</span>
            </div>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Allowances</span>
              <span className={styles.expenseValue}>{gbp(latestExpenses.allowances)}</span>
            </div>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Other expenses</span>
              <span className={styles.expenseValue}>{gbp(latestExpenses.other_expenses)}</span>
            </div>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Expenses ranking</span>
              <span className={styles.expenseValue}>{latestExpenses.rank}<span className={styles.expenseFraction}>/{latestExpenses.total_members}</span></span>
            </div>
            <div className={styles.expensesCard}>
              <span className={styles.expenseLabel}>Total</span>
              <span className={styles.expenseValue}>{gbp(latestExpenses.total)}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'expenses' && !latestExpenses && (
        <p className={styles.interestsEmpty}>No expenses data available.</p>
      )}

      {activeTab === 'interests' && (
        <div className={styles.interestsSection}>
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
