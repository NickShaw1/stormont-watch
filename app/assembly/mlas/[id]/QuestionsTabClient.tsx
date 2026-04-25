'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { type Question } from '@/lib/db/schema'
import Chart from 'chart.js/auto'
import { formatDate, stripPreamble, partyBorderColor } from '@/lib/format'
import styles from './mlaDetail.module.css'

type SerializedQuestion = Omit<Question, 'updatedAt'> & { updatedAt: string | null }

interface QuestionJson {
  question_id: string
  reference: string | null
  tabled_date: string
  answered_on_date: string | null
  question_text: string
  answer_text: string | null
  hansard_link: string | null
  department: string | null
  is_oral: boolean
  calendar_year: number
  answer_truncated: boolean
}

function fromJson(j: QuestionJson, personId: string): SerializedQuestion {
  return {
    id: 0,
    questionId: j.question_id,
    personId,
    reference: j.reference,
    tabledDate: j.tabled_date,
    answeredOnDate: j.answered_on_date,
    questionText: j.question_text,
    answerText: j.answer_text,
    hansardLink: j.hansard_link,
    departmentId: null,
    department: j.department,
    isOral: j.is_oral,
    answerTruncated: j.answer_truncated,
    calendarYear: j.calendar_year,
    mandate: '2022-2027',
    updatedAt: null,
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

const DEPT_COLORS = [
  '#e05c2a', '#3a7c5a', '#c4a020', '#7a4ba0', '#2a6fb5',
  '#b5523a', '#4a8060', '#8a6030',
]

interface Props {
  personId: string
  mandateStart: string | null
  recentQuestions: SerializedQuestion[]
  totalQuestions: number
  totalWritten: number
  totalOral: number
  questionsRankPos: number
  questionsRankTotal: number
  questionsRankColor: string | undefined
  questionsPartyRankPos: number
  questionsPartyRankTotal: number
  partyName: string | undefined
  hideStatistics: boolean
}

function linkifyText(text: string): string {
  return text.replace(
    /(https?:\/\/[^\s<>"')\]]+)/g,
    url => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--teal);text-decoration:underline;text-underline-offset:2px">${url}</a>`
  )
}

function ExpandedPanel({ q }: { q: SerializedQuestion }) {
  return (
    <div className={styles.qExpandedPanel}>
      <div className={styles.qExpandedQuestion}>
        <h3 className={styles.qExpandedLabelAnswer}><em>Question</em></h3>
        <p className={styles.qExpandedText}>{q.questionText}</p>
      </div>
      <div className={styles.qExpandedAnswer}>
        <h3 className={styles.qExpandedLabel}>Answer</h3>
        {q.answeredOnDate && <span className={styles.qAnsweredDate}>{formatDate(q.answeredOnDate)}</span>}
        {q.isOral && q.hansardLink ? (
          <a href={q.hansardLink} target="_blank" rel="noopener noreferrer" className={styles.hansardLink}>
            View answer in Official Report →
          </a>
        ) : q.answerText ? (
          <>
            <p className={styles.qAnswerText} dangerouslySetInnerHTML={{ __html: linkifyText(q.answerText) }} />
            {q.answerTruncated && (
              <p className={styles.qTruncatedNote}>Answer may be truncated</p>
            )}
          </>
        ) : (
          <p className={styles.qAwaitingAnswer}>Awaiting answer.</p>
        )}
      </div>
    </div>
  )
}

export default function QuestionsTabClient({ personId, mandateStart, recentQuestions, totalQuestions, totalWritten, totalOral, questionsRankPos, questionsRankTotal, questionsRankColor, questionsPartyRankPos, questionsPartyRankTotal, partyName, hideStatistics }: Props) {
  const [search, setSearch] = useState('')
  const [allLoaded, setAllLoaded] = useState<SerializedQuestion[] | null>(null)
  const [visibleCount, setVisibleCount] = useState(25)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [monthChartTitle, setMonthChartTitle] = useState('Last 12 months')

  const cacheRef = useRef<SerializedQuestion[] | null>(null)

  const writtenOralCanvasRef = useRef<HTMLCanvasElement>(null)
  const deptCanvasRef = useRef<HTMLCanvasElement>(null)
  const yearCanvasRef = useRef<HTMLCanvasElement>(null)
  const writtenOralChartInst = useRef<Chart | null>(null)
  const deptChartInst = useRef<Chart | null>(null)
  const yearChartInst = useRef<Chart | null>(null)

  // Search → reset visible count
  useEffect(() => { setVisibleCount(25) }, [search])

  // Charts: rebuild when data source changes
  useEffect(() => {
    const source = allLoaded ?? recentQuestions
    if (
      !writtenOralCanvasRef.current ||
      !deptCanvasRef.current ||
      !yearCanvasRef.current
    ) return

    writtenOralChartInst.current?.destroy()
    deptChartInst.current?.destroy()
    yearChartInst.current?.destroy()

    const written = source.filter(q => !q.isOral).length
    const oral = source.filter(q => q.isOral).length

    writtenOralChartInst.current = new Chart(writtenOralCanvasRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Written', 'Oral'],
        datasets: [{
          data: [written, oral],
          backgroundColor: ['#4f6bed', '#fa41b1'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } },
        },
      },
    })

    const deptMap = new Map<string, number>()
    for (const q of source) {
      const d = q.department ?? 'Unknown'
      deptMap.set(d, (deptMap.get(d) ?? 0) + 1)
    }
    const sorted = Array.from(deptMap.entries()).sort((a, b) => b[1] - a[1])
    const top5 = sorted.slice(0, 5)
    const otherCount = sorted.slice(5).reduce((sum, [, c]) => sum + c, 0)
    const shortName = (dept: string) => dept.replace(/^Department (?:of|for the|for) /i, '')
    const deptKeys = [...top5.map(([k]) => k), ...(otherCount > 0 ? ['Other'] : [])]
    const deptLabels = [...top5.map(([k]) => shortName(k)), ...(otherCount > 0 ? ['Other'] : [])]
    const deptData = [...top5.map(([, v]) => v), ...(otherCount > 0 ? [otherCount] : [])]

    deptChartInst.current = new Chart(deptCanvasRef.current, {
      type: 'doughnut',
      data: {
        labels: deptLabels,
        datasets: [{
          data: deptData,
          backgroundColor: DEPT_COLORS.slice(0, deptLabels.length),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } },
        },
        onClick(_, elements) {
          if (!elements.length) return
          const key = deptKeys[elements[0].index]
          if (key !== 'Other') setSearch(key)
        },
      },
    })

    // Build last-12-months (or since mandateStart) month labels
    const now = new Date()
    const earliest = mandateStart
      ? new Date(mandateStart)
      : new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
    const chartStart = earliest > twelveMonthsAgo ? earliest : twelveMonthsAgo

    const monthLabels: string[] = []
    const monthKeys: string[] = []
    const cur = new Date(chartStart.getFullYear(), chartStart.getMonth(), 1)
    while (cur <= now) {
      const yyyy = cur.getFullYear()
      const mm = String(cur.getMonth() + 1).padStart(2, '0')
      monthKeys.push(`${yyyy}-${mm}`)
      monthLabels.push(cur.toLocaleString('en-GB', { month: 'short', year: 'numeric' }))
      cur.setMonth(cur.getMonth() + 1)
    }

    const monthMap = new Map<string, number>()
    for (const q of source) {
      const key = q.tabledDate?.slice(0, 7)
      if (key && monthKeys.includes(key)) monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
    }
    // Filter out months with zero questions
    const nonZeroIndices = monthKeys.map((k, i) => ({ k, i })).filter(({ k }) => (monthMap.get(k) ?? 0) > 0)
    const filteredLabels = nonZeroIndices.map(({ i }) => monthLabels[i])
    const filteredData = nonZeroIndices.map(({ k }) => monthMap.get(k) ?? 0)

    const isLessThan12Months = earliest > twelveMonthsAgo
    const chartTitle = isLessThan12Months
      ? `Since ${earliest.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`
      : 'Last 12 months'

    yearChartInst.current = new Chart(yearCanvasRef.current, {
      type: 'line',
      data: {
        labels: filteredLabels,
        datasets: [{
          label: 'Questions',
          data: filteredData,
          borderColor: '#4f6bed',
          backgroundColor: 'rgba(79,107,237,0.1)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
          x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
        },
      },
    })
    setMonthChartTitle(chartTitle)

    return () => {
      writtenOralChartInst.current?.destroy()
      deptChartInst.current?.destroy()
      yearChartInst.current?.destroy()
    }
  }, [allLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`/data/questions/${personId}.json?v=${Date.now()}`)
      .then(r => r.json())
      .then((data: QuestionJson[]) => {
        const fromFile = data.map(j => fromJson(j, personId))
        const fileIds = new Set(fromFile.map(q => q.questionId))
        const extras = recentQuestions.filter(q => !fileIds.has(q.questionId))
        console.log('[questions] file:', fromFile.length, 'extras from recentQ:', extras.length, extras.map(q => q.tabledDate))
        const merged = [...extras, ...fromFile].sort((a, b) =>
          (b.tabledDate ?? '').localeCompare(a.tabledDate ?? '')
        )
        cacheRef.current = merged
        setAllLoaded(merged)
      })
      .catch(() => {})
  }, [personId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return null
    if (!allLoaded) return null

    const lower = q.toLowerCase()
    let results: SerializedQuestion[]

    if (/^\d{4}$/.test(q)) {
      const year = parseInt(q, 10)
      results = allLoaded.filter(item => item.calendarYear === year)
    } else if (lower === 'oral') {
      results = allLoaded.filter(item => item.isOral)
    } else if (lower === 'written') {
      results = allLoaded.filter(item => !item.isOral)
    } else {
      results = allLoaded.filter(item =>
        item.questionText.toLowerCase().includes(lower) ||
        (item.department?.toLowerCase().includes(lower) ?? false) ||
        (item.reference?.toLowerCase().includes(lower) ?? false)
      )
    }

    return results.sort((a, b) =>
      (b.tabledDate ?? '').localeCompare(a.tabledDate ?? '')
    )
  }, [search, allLoaded])

  const displayedItems = filtered ?? recentQuestions
  const visibleItems = filtered ? displayedItems.slice(0, visibleCount) : displayedItems
  const hasMore = filtered ? visibleCount < displayedItems.length : false




  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (totalQuestions === 0) {
    return (
      <div className={styles.questionsSection}>
        <p className={styles.qEmptyState}>No questions found for this MLA.</p>
      </div>
    )
  }

  return (
    <div className={styles.questionsSection}>
      {!hideStatistics && (
        <div>
          <h2 className={styles.questionsSectionHeading}>Questions <em>Statistics</em></h2>
          <p className={styles.questionsSectionDesc}>Rankings compare current non-minister MLAs only. Ministers and the First Minister and Deputy First Minister are excluded as their question totals are not comparable.</p>
        </div>
      )}
      {/* Overview 2×2 grid */}
      {!hideStatistics && <div className={styles.questionsOverviewGrid}>
        <div className={styles.questionsOverviewCard}>
          <div className={styles.overviewCardLabel}>Overview</div>
          <div className={styles.questionsTotalDisplay}>
            <span className={styles.questionsTotalNumber}>{totalQuestions.toLocaleString()}</span>
            <span className={styles.questionsTotalLabel}>questions asked</span>
          </div>
          <ul className={styles.overviewRankRows}>
            {questionsRankPos > 0 && questionsRankTotal > 0 && (
              <li className={styles.overviewRankSentence}>
                Ranked <strong style={{ color: questionsRankColor }}>{ordinal(questionsRankPos)}</strong> of {questionsRankTotal} MLAs by questions asked
              </li>
            )}
            {questionsPartyRankPos > 0 && questionsPartyRankTotal > 0 && partyName && (
              <li className={styles.overviewRankSentence}>
                Ranked <strong>{ordinal(questionsPartyRankPos)}</strong> of {questionsPartyRankTotal} <span style={{ color: partyBorderColor(partyName) }}>{partyName}</span> MLAs by questions asked
              </li>
            )}
          </ul>
          <div className={styles.overviewBreakdownRow}>
            <span className={styles.overviewBreakdownItem}>
              <span className={styles.qPillWritten}>Written</span>
              <span className={styles.overviewBreakdownCount}>{totalWritten}</span>
              <span className={styles.overviewBreakdownPct}>({totalQuestions > 0 ? Math.round(totalWritten / totalQuestions * 100) : 0}%)</span>
            </span>
            <span className={styles.overviewBreakdownItem}>
              <span className={styles.qPillOral}>Oral</span>
              <span className={styles.overviewBreakdownCount}>{totalOral}</span>
              <span className={styles.overviewBreakdownPct}>({totalQuestions > 0 ? Math.round(totalOral / totalQuestions * 100) : 0}%)</span>
            </span>
          </div>
        </div>
        <div className={styles.questionsOverviewCard}>
          <div className={styles.overviewCardLabel}>{monthChartTitle}</div>
          <div className={styles.overviewChartCanvas} aria-label="Bar chart showing questions per month over the last 12 months">
            <canvas ref={yearCanvasRef} />
          </div>
        </div>
        <div className={styles.questionsOverviewCard}>
          <div className={styles.overviewCardLabel}>Written vs Oral</div>
          <div className={styles.overviewChartCanvas} aria-label="Donut chart showing written versus oral question breakdown">
            <canvas ref={writtenOralCanvasRef} />
          </div>
        </div>
        <div className={styles.questionsOverviewCard}>
          <div className={styles.overviewCardLabel}>By department</div>
          <div className={styles.overviewChartCanvas} aria-label="Donut chart showing questions by department — click a segment to filter">
            <canvas ref={deptCanvasRef} />
          </div>
        </div>
      </div>}

      {!hideStatistics && <hr className="section-rule" />}

      <div>
        <h2 className={styles.questionsSectionHeading}>All <em>Questions</em></h2>
        <p className={styles.searchSubtext}>
          Showing <strong>{Math.min(10, totalQuestions)}</strong> most recent questions.{' '}
          {totalQuestions > 10 && (
            <>Search to explore all <strong>{totalQuestions.toLocaleString()}</strong> questions.</>
          )}
        </p>
      </div>
      <div className={styles.searchRow}>
        <input
          type="search"
          className={styles.searchInput}
          aria-label="Search questions"
          placeholder='Search questions…'
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Loading hint */}
      {search.trim() && !allLoaded && (
        <p className={styles.resultCount} role="status">Loading…</p>
      )}

      {/* Result count */}
      {filtered && (
        <p className={styles.resultCount} role="status" aria-live="polite" aria-atomic="true">
          <strong>{displayedItems.length}</strong> result{displayedItems.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Desktop list — hidden ≤640px */}
      <div className={styles.qDesktopList}>
        {visibleItems.length === 0 ? (
          <p className={styles.qEmptyState}>
            {filtered ? 'No questions match your search.' : 'No questions found for this member.'}
          </p>
        ) : visibleItems.map((q) => {
          const isExpanded = expandedIds.has(q.questionId)
          const answered = q.isOral ? !!q.hansardLink : !!q.answerText
          const strippedText = stripPreamble(q.questionText)
          const truncatedText = strippedText.length > 150 ? strippedText.slice(0, 150) + '…' : strippedText
          return (
            <div
              key={q.questionId}
              className={[
                styles.qDesktopRow,
                isExpanded ? styles.qDesktopRowOpen : '',
              ].filter(Boolean).join(' ')}
            >
              <div
                className={[
                  styles.qDesktopItem,
                  answered ? styles.qDesktopItemAnswered : styles.qDesktopItemUnanswered,
                ].filter(Boolean).join(' ')}
                onClick={() => toggleExpanded(q.questionId)}
                tabIndex={0}
                role="button"
                aria-expanded={isExpanded}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(q.questionId) }
                }}
              >
                <div className={styles.qDesktopRow1}>
                  <span className={styles.qSubjectText}>{truncatedText}</span>
                  <span className={styles.qDesktopChevron}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                <div className={styles.qDesktopRow2}>
                  <div className={styles.qMetaLeft}>
                    <span className={`${q.isOral ? styles.qPillOral : styles.qPillWritten}`}>
                      {q.isOral ? 'Oral' : 'Written'}
                    </span>
                    <span className={styles.qMetaSep}>·</span>
                    {q.department && <span className={styles.qMeta}>{q.department}</span>}
                    {q.department && <span className={styles.qMetaSep}>·</span>}
                    <span className={styles.qMeta}>{formatDate(q.tabledDate)}</span>
                    {q.reference && <span className={styles.qMetaSep}>·</span>}
                    {q.reference && <span className={styles.qMeta}>{q.reference}</span>}
                  </div>
                  <div className={styles.qMetaRight}>
                    {answered
                      ? <span className={styles.qAnsweredIcon}>Answered</span>
                      : <span className={styles.qUnansweredIcon}>Not answered</span>
                    }
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className={styles.qDesktopExpanded}>
                  <ExpandedPanel q={q} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile cards — hidden >640px */}
      <div className={styles.questionMobileCards}>
        {visibleItems.length === 0 ? (
          <p className={styles.qEmptyState}>
            {filtered ? 'No questions match your search.' : 'No questions found for this member.'}
          </p>
        ) : visibleItems.map(q => {
          const isExpanded = expandedIds.has(q.questionId)
          const answered = q.isOral ? !!q.hansardLink : !!q.answerText
          const strippedText = stripPreamble(q.questionText)
          const truncatedText = strippedText.length > 150 ? strippedText.slice(0, 150) + '…' : strippedText
          return (
            <div key={q.questionId} className={styles.qCard}>
              <div
                className={[
                  styles.qCardInner,
                  answered ? styles.qCardAnswered : styles.qCardUnanswered,
                ].filter(Boolean).join(' ')}
                onClick={() => toggleExpanded(q.questionId)}
                tabIndex={0}
                role="button"
                aria-expanded={isExpanded}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(q.questionId) }
                }}
              >
                <p className={styles.qCardBody}>{truncatedText}</p>
                <div className={styles.qMobileRow2}>
                  <span className={q.isOral ? styles.qPillOral : styles.qPillWritten}>
                    {q.isOral ? 'Oral' : 'Written'}
                  </span>
                  {q.department && (
                    <>
                      <span className={styles.qMetaSep}>·</span>
                      <span className={styles.qMobileMetaDept}>{q.department}</span>
                    </>
                  )}
                </div>
                <div className={styles.qMobileRow2}>
                  <span className={styles.qMobileMetaDate}>{formatDate(q.tabledDate)}</span>
                  {q.reference && (
                    <>
                      <span className={styles.qMetaSep}>·</span>
                      <span className={styles.qMobileMetaRef}>{q.reference}</span>
                    </>
                  )}
                </div>
                <div className={styles.qMobileRow3}>
                  {answered
                    ? <span className={styles.qAnsweredIcon}>Answered</span>
                    : <span className={styles.qUnansweredIcon}>Not answered</span>}
                  <span className={styles.qMobileChevron}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>
              {isExpanded && (
                <div className={styles.qCardExpanded}>
                  <ExpandedPanel q={q} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {hasMore && (
        <button
          className={styles.loadMore}
          onClick={() => setVisibleCount(c => c + 25)}
        >
          Load more ({displayedItems.length - visibleCount} remaining)
        </button>
      )}
    </div>
  )
}
