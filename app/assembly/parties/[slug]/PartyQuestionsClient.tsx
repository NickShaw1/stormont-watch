'use client'

import { useState, useEffect, useRef, useMemo, memo } from 'react'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, formatConstituency, stripPreamble, partyBorderColor, formatDate } from '@/lib/format'
import styles from './partyDetail.module.css'
import type { getPartyQuestionStats } from '@/lib/db/queries'

type Stats = NonNullable<Awaited<ReturnType<typeof getPartyQuestionStats>>>

interface Props {
  party: string
  partySlug: string
  stats: Stats
}

interface QuestionJson {
  question_id: string
  reference: string | null
  tabled_date: string
  answer_by_date: string | null
  answered_on_date: string | null
  question_text: string
  answer_text: string | null
  hansard_link: string | null
  department: string | null
  is_oral: boolean
  calendar_year: number
  answer_truncated: boolean
  person_id: string
  full_name: string
  constituency: string | null
}

type FlatQuestion = {
  questionId: string
  reference: string | null
  tabledDate: string
  answerByDate: string | null
  answeredOnDate: string | null
  questionText: string
  answerText: string | null
  hansardLink: string | null
  department: string | null
  isOral: boolean
  calendarYear: number
  answerTruncated: boolean
  personId: string
  fullName: string
  constituency: string | null
}

function fromJson(j: QuestionJson): FlatQuestion {
  return {
    questionId: j.question_id,
    reference: j.reference,
    tabledDate: j.tabled_date,
    answerByDate: j.answer_by_date,
    answeredOnDate: j.answered_on_date,
    questionText: j.question_text,
    answerText: j.answer_text,
    hansardLink: j.hansard_link,
    department: j.department,
    isOral: j.is_oral,
    calendarYear: j.calendar_year,
    answerTruncated: j.answer_truncated,
    personId: j.person_id,
    fullName: j.full_name,
    constituency: j.constituency,
  }
}


function StatMiniCard({ label, mla, count, note }: {
  label: string
  mla: { personId: string; fullName: string; constituency: string | null; imgUrl: string | null; count: number } | null
  count?: number
  note?: string
}) {
  if (!mla) return null
  return (
    <div className={styles.pqStatCard}>
      <div className={styles.pqStatCardLabel}>{label}</div>
      <div className={styles.pqStatCardBody}>
        <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={40} decorative square />
        <div className={styles.pqStatCardInfo}>
          <Link href={`/assembly/mlas/${mla.personId}`} className={styles.pqStatCardName}>
            {formatMemberName(mla.fullName)}
          </Link>
          {mla.constituency && (
            <span className={styles.pqStatCardConstituency}>{formatConstituency(mla.constituency)}</span>
          )}
        </div>
        <span className={styles.pqStatCardCount}>{(count ?? mla.count).toLocaleString()}</span>
      </div>
      {note && <div className={styles.pqStatCardNote}>{note}</div>}
    </div>
  )
}

const YearBarChart = memo(function YearBarChart({ byYear }: { byYear: { year: number | null; count: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<import('chart.js').Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current || byYear.length === 0) return
    let cancelled = false

    import('chart.js/auto').then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return
      chartRef.current?.destroy()
      chartRef.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: byYear.map(r => String(r.year ?? '?')),
          datasets: [{
            data: byYear.map(r => r.count),
            backgroundColor: 'rgba(79,107,237,0.2)',
            borderColor: '#4f6bed',
            borderWidth: 1,
            borderRadius: 3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
        },
      })
    })

    return () => {
      cancelled = true
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [byYear])

  if (byYear.length === 0) return null

  return (
    <div className={styles.pqChartWrap}>
      <div className={styles.pqChartHeading}>Questions by year</div>
      <div className={styles.pqChartCanvas} aria-label="Questions by year bar chart" role="img">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
})

const PAGE_SIZE = 25

export default function PartyQuestionsClient({ party, partySlug, stats }: Props) {
  const { totals, byYear, mostOverall, leastOverall, mostSixMonths, leastSixMonths, recentQuestions, memberCount } = stats

  const [search, setSearch] = useState('')
  const [allLoaded, setAllLoaded] = useState<FlatQuestion[] | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const cacheRef = useRef<FlatQuestion[] | null>(null)
  const loadingRef = useRef(false)

  const defaultQuestions: FlatQuestion[] = recentQuestions.map(q => ({
    questionId: q.questionId,
    reference: q.reference,
    tabledDate: q.tabledDate,
    answerByDate: q.answerByDate ?? null,
    answeredOnDate: q.answeredOnDate,
    questionText: q.questionText,
    answerText: q.answerText,
    hansardLink: q.hansardLink,
    department: q.department,
    isOral: q.isOral,
    calendarYear: q.calendarYear,
    answerTruncated: q.answerTruncated,
    personId: q.personId,
    fullName: q.fullName,
    constituency: q.constituency,
  }))

  async function loadJson() {
    if (cacheRef.current || loadingRef.current) return
    loadingRef.current = true
    try {
      const res = await fetch(`/data/questions/party/${partySlug}.json`)
      if (!res.ok) return
      const data: QuestionJson[] = await res.json()
      const mapped = data.map(fromJson)
      cacheRef.current = mapped
      setAllLoaded(mapped)
    } finally {
      loadingRef.current = false
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
    setVisibleCount(PAGE_SIZE)
    if (!cacheRef.current) loadJson()
  }

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const isFiltering = !!search

  const filtered = useMemo(() => {
    const src = search && allLoaded ? allLoaded : defaultQuestions
    let result = src

    if (search) {
      const q = search.toLowerCase()
      const isYear = /^\d{4}$/.test(q)
      const isOralFilter = q === 'oral'
      const isWrittenFilter = q === 'written'
      result = result.filter(r => {
        if (isYear) return String(r.calendarYear) === q
        if (isOralFilter) return r.isOral
        if (isWrittenFilter) return !r.isOral
        return (
          r.questionText.toLowerCase().includes(q) ||
          (r.department ?? '').toLowerCase().includes(q) ||
          (r.reference ?? '').toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q)
        )
      })
    }

    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, allLoaded])

  const showFiltered = isFiltering
  const displayList = showFiltered ? filtered.slice(0, visibleCount) : defaultQuestions
  const hasMore = showFiltered && visibleCount < filtered.length

  const total = Number(totals?.total ?? 0)
  const oral = Number(totals?.oral ?? 0)
  const written = total - oral
  const writtenPct = total > 0 ? Math.round(written / total * 100) : 0
  const oralPct = total > 0 ? Math.round(oral / total * 100) : 0

  const isSingle = memberCount === 1
  const soloMla = mostOverall

  const byYearMemo = useMemo(
    () => byYear.map(r => ({ year: r.year, count: Number(r.count) })),
    [byYear]
  )

  return (
    <div className={styles.pqSection}>
      {isSingle && soloMla ? (
        <p className={styles.pqSummaryLine}>
          <Link href={`/assembly/mlas/${soloMla.personId}`} className={styles.pqSummaryLink}>
            {formatMemberName(soloMla.fullName)}
          </Link>
          {soloMla.constituency ? `, ${formatConstituency(soloMla.constituency)},` : ''}{' '}
          has asked <strong>{soloMla.count.toLocaleString()}</strong> question{soloMla.count !== 1 ? 's' : ''} since May 2022.
        </p>
      ) : (
        <>
          <div className={styles.pqSummaryGrid}>
            <div className={styles.pqSummaryStatCard}>
              <span className={styles.statLabel}>Total Questions</span>
              <span className={styles.statValue}>{total.toLocaleString()}</span>
              <span className={styles.statSub}>since May 2022</span>
            </div>
            <div className={styles.pqSummaryStatCard}>
              <span className={styles.qPillWritten}>Written</span>
              <span className={styles.statValue}>{written.toLocaleString()}</span>
              <span className={styles.statSub}>{writtenPct}% of total</span>
            </div>
            <div className={styles.pqSummaryStatCard}>
              <span className={styles.qPillOral}>Oral</span>
              <span className={styles.statValue}>{oral.toLocaleString()}</span>
              <span className={styles.statSub}>{oralPct}% of total</span>
            </div>
          </div>
          <div className={styles.pqSummaryCardMobile}>
            <div className={styles.pqTotalDisplay}>
              <span className={styles.pqTotalNumber}>{total.toLocaleString()}</span>
              <span className={styles.pqTotalLabel}>questions asked</span>
            </div>
            <ul className={styles.pqBreakdownList}>
              <li className={styles.pqBreakdownItem}>
                <span className={styles.qPillWritten}>Written</span>
                <span className={styles.pqBreakdownCount}>{written.toLocaleString()} <span className={styles.pqBreakdownPct}>({writtenPct}%)</span></span>
              </li>
              <li className={styles.pqBreakdownItem}>
                <span className={styles.qPillOral}>Oral</span>
                <span className={styles.pqBreakdownCount}>{oral.toLocaleString()} <span className={styles.pqBreakdownPct}>({oralPct}%)</span></span>
              </li>
            </ul>
          </div>
          <hr className="section-rule" />
          <div className={styles.pqStatGrid}>
            <StatMiniCard label="Most questions overall" mla={mostOverall} />
            <StatMiniCard label="Most active (last 6 months)" mla={mostSixMonths} />
            <StatMiniCard label="Fewest questions overall" mla={leastOverall} />
            <StatMiniCard label="Least active (last 6 months)" mla={leastSixMonths} />
          </div>
          <hr className="section-rule" />
        </>
      )}

      <YearBarChart byYear={byYearMemo} />
      <hr className="section-rule" />
      <h3 className={styles.statsHeading}>Party Questions</h3>

      <div className={styles.pqSearchArea}>
        <p className={styles.pqSearchSubtext}>
          Showing <strong>10</strong> most recent questions.{' '}
          {total > 10 && <>Search to explore all <strong>{total.toLocaleString()}</strong> questions.</>}
        </p>
        <div className={styles.pqSearchRow}>
          <input
            type="search"
            className={styles.pqSearchInput}
            placeholder="Search questions…"
            aria-label="Search party questions"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        {showFiltered && (
          <p className={styles.pqResultCount} role="status" aria-live="polite" aria-atomic="true">
            {filtered.length === 0
              ? 'No questions match your search'
              : <><strong>{filtered.length}</strong> result{filtered.length !== 1 ? 's' : ''}</>
            }
          </p>
        )}
      </div>

      {/* Desktop list */}
      <div className={styles.pqDesktopList}>
        {displayList.length === 0 && showFiltered ? (
          <p className={styles.pqEmptyMobile}>No questions match your search</p>
        ) : displayList.length === 0 ? (
          <p className={styles.pqEmptyMobile}>No questions found for this party.</p>
        ) : displayList.map(q => {
          const isOpen = expandedIds.has(q.questionId)
          const answered = !!q.answerText || !!q.hansardLink
          const strippedText = stripPreamble(q.questionText)
          const truncatedText = strippedText.length > 150 ? strippedText.slice(0, 150) + '…' : strippedText
          return (
            <div key={q.questionId} className={`${styles.pqDesktopRow} ${isOpen ? styles.pqDesktopRowOpen : ''}`}>
              <div
                className={`${styles.pqDesktopItem} ${answered ? styles.pqDesktopItemAnswered : styles.pqDesktopItemUnanswered}`}
                onClick={() => toggleExpanded(q.questionId)}
                tabIndex={0}
                role="button"
                aria-expanded={isOpen}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(q.questionId) } }}
              >
                <div className={styles.pqDesktopRow0}>
                  <span className={styles.pqPartyDot} style={{ background: partyBorderColor(party) }} />
                  <Link href={`/assembly/mlas/${q.personId}`} className={styles.pqMlaNameLink} onClick={e => e.stopPropagation()}>
                    {formatMemberName(q.fullName)}
                  </Link>
                  {q.constituency && (
                    <><span className={styles.pqMetaSep}>·</span><span className={styles.pqMlaConstituencyInline}>{formatConstituency(q.constituency)}</span></>
                  )}
                </div>
                <div className={styles.pqDesktopRow1}>
                  <span className={styles.pqSubjectText}>{truncatedText}</span>
                  <span className={styles.pqDesktopChevron}>{isOpen ? '▲' : '▼'}</span>
                </div>
                <div className={styles.pqDesktopRow2}>
                  <div className={styles.pqMetaLeft}>
                    <span className={q.isOral ? styles.qPillOral : styles.qPillWritten}>{q.isOral ? 'Oral' : 'Written'}</span>
                    <span className={styles.pqMetaSep}>·</span>
                    {q.department && <span className={styles.pqMeta}>{q.department}</span>}
                    {q.department && <span className={styles.pqMetaSep}>·</span>}
                    <span className={styles.pqMeta}>{formatDate(q.tabledDate)}</span>
                    {q.reference && <><span className={styles.pqMetaSep}>·</span><span className={styles.pqMeta}>{q.reference}</span></>}
                  </div>
                  <div className={styles.pqMetaRight}>
                    {answered
                      ? <span className={styles.pqAnsweredIcon}>Answered</span>
                      : (() => {
                          const today = new Date().toISOString().slice(0, 10)
                          const due = q.answerByDate
                          const isLate = due && today > due
                          return (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {isLate
                                ? <span className={styles.qPillLate}>Late · Due {formatDate(due)}</span>
                                : due
                                  ? <span className={styles.qPillDue}>Due {formatDate(due)}</span>
                                  : null
                              }
                              <span className={styles.pqUnansweredIcon}>No answer</span>
                            </span>
                          )
                        })()
                    }
                  </div>
                </div>
              </div>
              {isOpen && (
                <div className={styles.pqDesktopExpanded}>
                  <div className={styles.pqDetailInner}>
                    <div className={styles.pqExpandedQuestion}>
                      <span className={styles.pqExpandedLabel}>Question</span>
                      <p className={styles.pqExpandedText}>{q.questionText}</p>
                    </div>
                    <div className={styles.pqExpandedAnswer}>
                      <span className={styles.pqExpandedLabel}>Answer</span>
                      {q.isOral && q.hansardLink ? (
                        <a href={q.hansardLink} target="_blank" rel="noopener noreferrer" className={styles.hansardLink}>View answer in Official Report →</a>
                      ) : q.answerText ? (
                        <>
                          <p className={styles.pqAnswerText}>{q.answerText}</p>
                          {q.answerTruncated && <p className={styles.pqTruncatedNote}>Answer may be truncated — view full answer on the Assembly website.</p>}
                        </>
                      ) : (
                        <p className={styles.pqTruncatedNote}>Awaiting answer.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile cards */}
      <div className={styles.pqMobileCards}>
        {displayList.length === 0 && showFiltered ? (
          <p className={styles.pqEmptyMobile}>No questions match your search</p>
        ) : displayList.length === 0 ? (
          <p className={styles.pqEmptyMobile}>No questions found for this party.</p>
        ) : displayList.map(q => {
          const isOpen = expandedIds.has(q.questionId)
          const answered = !!q.answerText || !!q.hansardLink
          const strippedText = stripPreamble(q.questionText)
          const cardText = strippedText.length > 150 ? strippedText.slice(0, 150) + '…' : strippedText
          return (
            <div key={q.questionId} className={styles.pqCard}>
              <div
                className={`${styles.pqCardInner} ${answered ? styles.pqCardAnswered : styles.pqCardUnanswered}`}
                onClick={() => toggleExpanded(q.questionId)}
                tabIndex={0}
                role="button"
                aria-expanded={isOpen}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(q.questionId) } }}
              >
                <div className={styles.pqMobileRow0}>
                  <span className={styles.pqPartyDot} style={{ background: partyBorderColor(party) }} />
                  <span className={styles.pqMlaNameInline}>{formatMemberName(q.fullName)}</span>
                  {q.constituency && (
                    <><span className={styles.pqMetaSep}>·</span><span className={styles.pqMlaConstituencyInline}>{formatConstituency(q.constituency)}</span></>
                  )}
                </div>
                <div className={styles.pqMobileCardMeta}>
                  {q.department && <span className={styles.pqMobileMetaDept}>{q.department}</span>}
                </div>
                <p className={styles.pqCardBody}>{cardText}</p>
                <div className={styles.pqMobileRow2}>
                  <span className={q.isOral ? styles.qPillOral : styles.qPillWritten}>{q.isOral ? 'Oral' : 'Written'}</span>
                </div>
                <div className={styles.pqMobileRow2}>
                  <span className={styles.pqMobileMetaDate}>{formatDate(q.tabledDate)}</span>
                  {q.reference && (<><span className={styles.pqMetaSep}>·</span><span className={styles.pqMobileMetaRef}>{q.reference}</span></>)}
                </div>
                <div className={styles.pqMobileRow3}>
                  {answered
                    ? <span className={styles.pqAnsweredIcon}>Answered</span>
                    : (() => {
                        const today = new Date().toISOString().slice(0, 10)
                        const due = q.answerByDate
                        const isLate = due && today > due
                        return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {isLate
                              ? <span className={styles.qPillLate}>Late · Due {formatDate(due)}</span>
                              : due
                                ? <span className={styles.qPillDue}>Due {formatDate(due)}</span>
                                : null
                            }
                            <span className={styles.pqUnansweredIcon}>No answer</span>
                          </span>
                        )
                      })()
                  }
                  <span className={styles.pqMobileChevron}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>
              {isOpen && (
                <div className={styles.pqCardExpanded}>
                  <div className={styles.pqDetailInner}>
                    <div className={styles.pqExpandedQuestion}>
                      <span className={styles.pqExpandedLabel}>Question</span>
                      <p className={styles.pqExpandedText}>{q.questionText}</p>
                    </div>
                    <div className={styles.pqExpandedAnswer}>
                      <span className={styles.pqExpandedLabel}>Answer</span>
                      {q.isOral && q.hansardLink ? (
                        <a href={q.hansardLink} target="_blank" rel="noopener noreferrer" className={styles.hansardLink}>View answer in Official Report →</a>
                      ) : q.answerText ? (
                        <>
                          <p className={styles.pqAnswerText}>{q.answerText}</p>
                          {q.answerTruncated && <p className={styles.pqTruncatedNote}>Answer may be truncated — view full answer on the Assembly website.</p>}
                        </>
                      ) : (
                        <p className={styles.pqTruncatedNote}>Awaiting answer.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {hasMore && (
        <button
          className={styles.pqLoadMore}
          onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
        >
          Load more ({filtered.length - visibleCount} remaining)
        </button>
      )}
    </div>
  )
}
