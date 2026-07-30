'use client'

import { useState, useEffect, useRef } from 'react'
import {
  MessageCircleQuestion, FileText, Mic, CalendarCheck, MessagesSquare, TrendingUp,
  Wallet, CalendarRange, PoundSterling, BarChart3, Award, Newspaper, Users, MapPin,
} from 'lucide-react'
import styles from './mlaDetail.module.css'
import type { RoleInterval } from '@/lib/salaries'
import { useMandate } from '@/components/MandateContext'

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
  currentSalary: number | null
  mandateEarnings: number | null
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

// Register categories are data-driven, so colours cycle by index, not by name.
const CATEGORY_ICON_COLORS = [
  'tileIconIndigo', 'tileIconGreen', 'tileIconCoral', 'tileIconTeal',
  'tileIconPurple', 'tileIconPink', 'tileIconOrange', 'tileIconBlue',
]


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

    let chart: { destroy: () => void } | null = null
    const root = getComputedStyle(document.documentElement)
    const tickColor = root.getPropertyValue('--sw-text-tertiary').trim() || '#656b72'
    const gridColor = root.getPropertyValue('--sw-border').trim() || '#dcded9'

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
            y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 }, color: tickColor }, grid: { color: gridColor } },
          },
        },
      })
    })

    return () => { chart?.destroy() }
  }, [questionStats, partyColor])

  return (
    <div className={styles.chartSection}>
      <h3 className={styles.chartTitle}>
        <BarChart3 className={styles.financesSectionHeadingIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
        Questions asked by month
      </h3>
      <p className={styles.chartDesc}>Total written and oral questions submitted to ministers each month over the last 12 months.</p>
      <div className={styles.chartCanvasWrap}>
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

    let chart: { destroy: () => void } | null = null
    const root = getComputedStyle(document.documentElement)
    const tickColor = root.getPropertyValue('--sw-text-tertiary').trim() || '#656b72'
    const gridColor = root.getPropertyValue('--sw-border').trim() || '#dcded9'
    const neutralBarColor = root.getPropertyValue('--sw-surface-subtle').trim() || '#eceef0'
    const tooltipBg = root.getPropertyValue('--sw-text-primary').trim() || '#1a1d21'
    const tooltipFg = root.getPropertyValue('--sw-surface').trim() || '#ffffff'

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
              backgroundColor: neutralBarColor,
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
              backgroundColor: tooltipBg,
              titleColor: tooltipFg,
              bodyColor: tooltipFg,
              borderWidth: 0,
              padding: 12,
              cornerRadius: 3,
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
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: tickColor, maxRotation: 45, autoSkip: true, maxTicksLimit: 12 } },
            y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 }, color: tickColor, stepSize: 5 }, grid: { color: gridColor } },
          },
        },
      })
    })

    return () => { chart?.destroy() }
  }, [hansardRows, hansardSittingsByMonth, partyColor])

  return (
    <div className={styles.chartSection}>
      <h3 className={styles.chartTitle}>
        <BarChart3 className={styles.financesSectionHeadingIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
        Plenary participation by month
      </h3>
      <p className={styles.chartDesc}>How many plenary sittings this MLA spoke in each month, compared to the total sittings that month.</p>
      <div className={styles.chartLegend}>
        <span className={styles.chartLegendItem}>
          <span className={styles.chartLegendSwatch} style={{ background: 'var(--sw-surface-subtle)', border: '1px solid var(--sw-border-strong)' }} />
          Total sittings that month
        </span>
        <span className={styles.chartLegendItem}>
          <span className={styles.chartLegendSwatch} style={{ background: partyColor }} />
          Sittings spoken in
        </span>
      </div>
      <div className={styles.chartCanvasWrap}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

export default function ActivityTabsClient(props: Props) {
  const { allExpenses, interests, totalQuestions, writtenCount, oralCount, questionStats, hideQuestionsTab, partyColor, questionRank, currentSalary, mandateEarnings, mandateExpensesRank, mandateExpensesTotalMembers, hansardRows, hansardRank, hansardDebateRank, hansardSittingsByMonth } = props
  const { mandate } = useMandate()
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
      <div className={styles.financesTabPanel}>
      <div className={styles.financesTabs} role="tablist" aria-label="Activity sections">
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
              <div className={`${styles.sectionHead} ${styles.sectionHeadWithSubtitle}`}>
                <span className={styles.sectionEyebrow}>To ministers</span>
                <h3 className={styles.sectionHeading}>
                  <MessageCircleQuestion className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                  Questions to Ministers
                </h3>
                <p className={styles.sectionSubtitle}>Written and oral questions formally submitted to ministers since mandate start. Rankings exclude current ministers and the Speaker.</p>
              </div>
              <div className={styles.questionsCard}>
                <div className={styles.questionsSummary}>
                  <div className={styles.questionsSummaryCell}>
                    <MessageCircleQuestion className={`${styles.tileIcon} ${styles.tileIconBlue}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.questionsSummaryLabel}>Total questions</span>
                    <div className={styles.questionsSummaryValueCol}>
                      <span className={styles.questionsSummaryValue}>{totalQuestions.toLocaleString()}</span>
                      {questionRank && (() => {
                        const { rank, totalEligible } = questionRank
                        const pctile = totalEligible > 1 ? (rank - 1) / (totalEligible - 1) : 0
                        const color = pctile <= 0.33 ? 'var(--sw-success)' : pctile <= 0.66 ? 'var(--sw-warning)' : 'var(--sw-error)'
                        return <span className={styles.questionsSummarySubtitle} style={{ color }}>Ranked {rank}/{totalEligible}</span>
                      })()}
                    </div>
                  </div>
                  <div className={styles.questionsSummaryCell}>
                    <FileText className={`${styles.tileIcon} ${styles.tileIconTeal}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.questionsSummaryLabel}>Written</span>
                    <div className={styles.questionsSummaryValueCol}>
                      <span className={styles.questionsSummaryValue}>{writtenCount.toLocaleString()}</span>
                      <span className={styles.questionsSummarySubtitle}>{pct(writtenCount, totalQuestions)}% of total</span>
                    </div>
                  </div>
                  <div className={styles.questionsSummaryCell}>
                    <Mic className={`${styles.tileIcon} ${styles.tileIconPurple}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.questionsSummaryLabel}>Oral</span>
                    <div className={styles.questionsSummaryValueCol}>
                      <span className={styles.questionsSummaryValue}>{oralCount.toLocaleString()}</span>
                      <span className={styles.questionsSummarySubtitle}>{pct(oralCount, totalQuestions)}% of total</span>
                    </div>
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
                <div className={`${styles.sectionHead} ${(!hideQuestionsTab && totalQuestions > 0) ? styles.sectionHeadSpaced : ''} ${styles.sectionHeadWithSubtitle}`}>
                  <span className={styles.sectionEyebrow}>Plenary</span>
                  <h3 className={styles.sectionHeading}>
                    <CalendarCheck className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                    Plenary Participation
                  </h3>
                  <p className={styles.sectionSubtitle}>Sittings and debates this MLA has spoken in during plenary sessions since mandate start. Rankings exclude presiding officers only: ministers are included as they participate in plenary debates in their capacity as MLAs.</p>
                </div>
                <div className={styles.questionsCard}>
                  <div className={styles.questionsSummary}>
                    <div className={styles.questionsSummaryCell}>
                      <CalendarCheck className={`${styles.tileIcon} ${styles.tileIconGreen}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                      <span className={styles.questionsSummaryLabel}>Sittings</span>
                      <div className={styles.questionsSummaryValueCol}>
                        <span className={styles.questionsSummaryValue}>{distinctSittings.toLocaleString()}/{hansardSittingsByMonth.reduce((acc, row) => acc + Number(row.totalSittings), 0).toLocaleString()}</span>
                        {hansardRank && (() => {
                          const { rank, eligibleCount } = hansardRank
                          const pctile = eligibleCount > 1 ? (rank - 1) / (eligibleCount - 1) : 0
                          const color = pctile <= 0.33 ? 'var(--sw-success)' : pctile <= 0.66 ? 'var(--sw-warning)' : 'var(--sw-error)'
                          return <span className={styles.questionsSummarySubtitle} style={{ color }}>Ranked {rank}/{eligibleCount}</span>
                        })()}
                        {!hansardRank && <span className={styles.questionsSummarySubtitle}>spoken in this mandate</span>}
                      </div>
                    </div>
                    <div className={styles.questionsSummaryCell}>
                      <MessagesSquare className={`${styles.tileIcon} ${styles.tileIconCoral}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                      <span className={styles.questionsSummaryLabel}>Debates Contributed To</span>
                      <div className={styles.questionsSummaryValueCol}>
                        <span className={styles.questionsSummaryValue}>{distinctDebates.toLocaleString()}</span>
                        {hansardDebateRank && (() => {
                          const { rank, eligibleCount } = hansardDebateRank
                          const pctile = eligibleCount > 1 ? (rank - 1) / (eligibleCount - 1) : 0
                          const color = pctile <= 0.33 ? 'var(--sw-success)' : pctile <= 0.66 ? 'var(--sw-warning)' : 'var(--sw-error)'
                          return <span className={styles.questionsSummarySubtitle} style={{ color }}>Ranked {rank}/{eligibleCount}</span>
                        })()}
                        {!hansardDebateRank && <span className={styles.questionsSummarySubtitle}>times spoken in the chamber</span>}
                      </div>
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
                          <TrendingUp className={`${styles.tileIcon} ${styles.tileIconOrange}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                          <span className={styles.questionsSummaryLabel}>Most Active Month</span>
                          <div className={styles.questionsSummaryValueCol}>
                            <span className={styles.questionsSummaryValue}>{label}</span>
                            <span className={styles.questionsSummarySubtitle}>{bestCount} sittings spoken in</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
                <SpeechesChart hansardRows={hansardRows} hansardSittingsByMonth={hansardSittingsByMonth} partyColor={partyColor} />
                <div className={`${styles.sectionHead} ${styles.sectionHeadSpaced}`}>
                  <span className={styles.sectionEyebrow}>Latest</span>
                  <h3 className={styles.sectionHeading}>
                    <Newspaper className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                    Recent Activity
                  </h3>
                </div>

                <div className={styles.speechDebateWrap}>
                  {recentFive.map((row, i) => {
                    const d = new Date(`${row.plenaryDate}T12:00:00Z`)
                    const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(d).toUpperCase()
                    const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(d)
                    return (
                      <div key={i} className={styles.speechDebateRow}>
                        <div className={styles.speechDebateDateBlock}>
                          <span className={styles.speechDebateWeekday}>{weekday}</span>
                          <span className={styles.speechDebateDayNum}>{d.getUTCDate()}</span>
                          <span className={styles.speechDebateMonth}>{month}</span>
                        </div>
                        <div className={styles.speechDebateCard}>
                          <a
                            href={`https://aims.niassembly.gov.uk/officialreport/report.aspx?&eveDate=${row.plenaryDate}&docID=${row.reportDocId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.speechDebateLink}
                          >
                            <span className={styles.speechDebateTitle}>{row.debateTitle}</span>
                            <span className={styles.speechDebateType}>Hansard</span>
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}

        </div>
      )}

      {activeTab === 'finances' && (
        <div id="panel-finances" role="tabpanel" aria-labelledby="tab-finances" className={styles.financesPanel}>
          <div className={styles.financesColumns}>
            <div className={styles.salaryPanel}>
              <h3 className={styles.financesSectionHeading}>
                <Wallet className={styles.financesSectionHeadingIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
                Salary &amp; earnings
              </h3>
              {currentSalary === null && mandateEarnings === null ? (
                <p className={styles.salaryNotice}>Salary figures for the {mandate.label} mandate are not yet available: the Assembly&apos;s published pay rates for this mandate have not been released.</p>
              ) : (
                <>
                  <p className={styles.salaryNotice}>Salary estimates are based on published Assembly rates and may not reflect all personal circumstances.</p>
                  <div className={styles.salaryCardsSingle}>
                    <div className={styles.salaryCard}>
                      <CalendarRange className={`${styles.tileIcon} ${styles.tileIconIndigo}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                      <span className={styles.questionsSummaryLabel}>Mandate</span>
                      <span className={styles.questionsSummaryValue}>{mandate.label}</span>
                    </div>
                    <div className={styles.salaryCard}>
                      <Wallet className={`${styles.tileIcon} ${styles.tileIconGreen}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                      <span className={styles.questionsSummaryLabel}>Current annual salary</span>
                      <span className={styles.questionsSummaryValue}>{currentSalary === null ? 'N/A' : gbpSalary(currentSalary)}</span>
                    </div>
                    <div className={styles.salaryCard}>
                      <TrendingUp className={`${styles.tileIcon} ${styles.tileIconTeal}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                      <span className={styles.questionsSummaryLabel}>Estimated mandate earnings</span>
                      <span className={styles.questionsSummaryValue}>{mandateEarnings === null ? 'N/A' : gbpSalary(mandateEarnings)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {allExpenses.length > 0 && (
              <div className={styles.salaryPanel}>
                <h3 className={styles.financesSectionHeading}>
                  <PoundSterling className={styles.financesSectionHeadingIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
                  Costs and Ranking
                </h3>
                <p className={styles.salaryNotice}>Costs claimed for staffing, constituency office running costs and other approved allowances, published quarterly by the Assembly.</p>

                <div className={styles.salaryCardsSingle}>
                  <div className={styles.salaryCard}>
                    <PoundSterling className={`${styles.tileIcon} ${styles.tileIconBlue}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.questionsSummaryLabel}>Total mandate expenses</span>
                    <span className={styles.questionsSummaryValue}>{gbp(mandateTotalExpenses.toFixed(2))}</span>
                  </div>
                  <div className={styles.salaryCard}>
                    <BarChart3 className={styles.tileIcon} size={17} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.questionsSummaryLabel}>{(selectedExpenses?.period ?? selectedYear).replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, m => m.slice(0, 3))} expenses rank</span>
                    <span className={styles.questionsSummaryValue}>
                      {selectedExpenses ? (() => {
                        const pctile = selectedExpenses.total_members > 1 ? (selectedExpenses.rank - 1) / (selectedExpenses.total_members - 1) : 0
                        const color = pctile <= 0.33 ? 'var(--sw-error)' : pctile <= 0.66 ? 'var(--sw-warning)' : 'var(--sw-success)'
                        return <span style={{ color }}>{selectedExpenses.rank}<span className={styles.expenseFraction}>/{selectedExpenses.total_members}</span></span>
                      })() : <span className={styles.statMuted}>N/A</span>}
                    </span>
                  </div>
                  <div className={styles.salaryCard}>
                    <Award className={styles.tileIcon} size={17} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.questionsSummaryLabel}>Overall mandate expenses rank</span>
                    <span className={styles.questionsSummaryValue}>
                      {mandateExpensesRank !== null && mandateExpensesTotalMembers !== null ? (() => {
                        const pctile = mandateExpensesTotalMembers > 1 ? (mandateExpensesRank - 1) / (mandateExpensesTotalMembers - 1) : 0
                        const color = pctile <= 0.33 ? 'var(--sw-error)' : pctile <= 0.66 ? 'var(--sw-warning)' : 'var(--sw-success)'
                        return <span style={{ color }}>{mandateExpensesRank}<span className={styles.expenseFraction}>/{mandateExpensesTotalMembers}</span></span>
                      })() : <span className={styles.statMuted}>N/A</span>}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {allExpenses.length === 0 && (
              <div className={styles.salaryPanel}>
                <h3 className={styles.financesSectionHeading}>
                  <PoundSterling className={styles.financesSectionHeadingIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
                  Costs and Ranking
                </h3>
                <p className={styles.interestsEmpty}>No expenses data available.</p>
              </div>
            )}
          </div>

          {allExpenses.length > 0 && selectedExpenses && (
            <div className={`${styles.salaryPanel} ${styles.expensesBreakdownPanel}`}>
              <div className={styles.expensesBreakdownHead}>
                <div>
                  <h3 className={styles.financesSectionHeading}>
                    <FileText className={styles.financesSectionHeadingIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
                    Expenses breakdown
                  </h3>
                  <p className={styles.salaryNotice}>How {selectedExpenses.period ?? selectedYear} expenses split across staffing, office and other approved costs.</p>
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
                            tabIndex={0}
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
              </div>

              <div className={styles.expensesGrid}>
                <div className={styles.expensesCard}>
                  <Users className={`${styles.tileIcon} ${styles.tileIconCoral}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.expenseLabel}>Staff costs</span>
                  <span className={styles.expenseValue}>{gbp(selectedExpenses.staff_costs)}</span>
                </div>
                <div className={styles.expensesCard}>
                  <MapPin className={`${styles.tileIcon} ${styles.tileIconPink}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.expenseLabel}>Constituency office</span>
                  <span className={styles.expenseValue}>{gbp(selectedExpenses.constituency_office)}</span>
                </div>
                <div className={styles.expensesCard}>
                  <Wallet className={`${styles.tileIcon} ${styles.tileIconOrange}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.expenseLabel}>Allowances</span>
                  <span className={styles.expenseValue}>{gbp(selectedExpenses.allowances)}</span>
                </div>
                <div className={styles.expensesCard}>
                  <FileText className={`${styles.tileIcon} ${styles.tileIconPurple}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.expenseLabel}>Other expenses</span>
                  <span className={styles.expenseValue}>{gbp(selectedExpenses.other_expenses)}</span>
                </div>
              </div>
              <div className={styles.expensesTotalRow}>
                <PoundSterling className={`${styles.tileIcon} ${styles.tileIconBlue}`} size={17} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.expenseLabel}>Total</span>
                <span className={styles.expenseValue}>{gbp(selectedExpenses.total)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'interests' && (
        <div id="panel-interests" role="tabpanel" aria-labelledby="tab-interests" className={styles.interestsSection}>
          {interests.length === 0 ? (
            <p className={styles.interestsEmpty}>No interests currently registered.</p>
          ) : (
            Object.entries(grouped).map(([category, entries], i) => (
              <div key={category} className={styles.interestCategory}>
                <h3 className={styles.sectionHeading}>
                  <FileText className={`${styles.sectionHeadingIcon} ${styles[CATEGORY_ICON_COLORS[i % CATEGORY_ICON_COLORS.length]]}`} size={22} strokeWidth={1.75} aria-hidden="true" />
                  {toSentenceCase(category)}
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
    </div>
  )
}
