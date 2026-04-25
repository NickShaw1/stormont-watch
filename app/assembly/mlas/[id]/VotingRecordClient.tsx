'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { isPassed } from '@/lib/bills'
import { formatDate } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import styles from './mlaDetail.module.css'

type VoteRow = {
  vote: string
  subject: string
  title: string | null
  divisionDate: Date
  outcome: string | null
  documentId: string
  divisionType: string | null
}

type Filter = 'ALL' | 'AYE' | 'NO' | 'NO_SHOW' | 'ABSTAINED'

interface Props {
  votes: VoteRow[]
  memberName: string
  noExpensesTab?: boolean
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL',      label: 'All' },
  { key: 'AYE',      label: 'Aye' },
  { key: 'NO',       label: 'No' },
  { key: 'NO_SHOW',  label: 'No Show' },
  { key: 'ABSTAINED', label: 'Abstain' },
]


const ITEMS_PER_PAGE = 25

export default function VotingRecordClient({ votes, memberName, noExpensesTab }: Props) {
  const [filter, setFilter] = useState<Filter>('ALL')
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const filteredVotes = filter === 'ALL' ? votes : votes.filter((v) => v.vote === filter)

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE)
  }, [filter])

  const visibleVotes = filteredVotes.slice(0, visibleCount)
  const hasMore = visibleCount < filteredVotes.length

  const counts: Record<Filter, number> = {
    ALL:       votes.length,
    AYE:       votes.filter((v) => v.vote === 'AYE').length,
    NO:        votes.filter((v) => v.vote === 'NO').length,
    NO_SHOW:   votes.filter((v) => v.vote === 'NO_SHOW').length,
    ABSTAINED: votes.filter((v) => v.vote === 'ABSTAINED').length,
  }

  const visibleFilters = FILTERS.filter((f) => f.key === 'ALL' || counts[f.key] > 0)

  const tabRefs = useRef<Record<Filter, HTMLButtonElement | null>>({
    ALL: null, AYE: null, NO: null, NO_SHOW: null, ABSTAINED: null,
  })

  function handleKeyDown(e: React.KeyboardEvent, currentKey: Filter) {
    const keys = visibleFilters.map((f) => f.key)
    const index = keys.indexOf(currentKey)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = keys[(index + 1) % keys.length]
      setFilter(next)
      tabRefs.current[next]?.focus()
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = keys[(index - 1 + keys.length) % keys.length]
      setFilter(prev)
      tabRefs.current[prev]?.focus()
    }
  }

  return (
    <section aria-labelledby="voting-record-heading">
      <div className={styles.recordHeader}>
        <h2 id="voting-record-heading" className={`${styles.sectionHeading}${noExpensesTab ? ` ${styles.noExpensesTop}` : ''}`}>Voting record</h2>
        <div
          className={`${styles.filters}${noExpensesTab ? ` ${styles.noExpensesTop}` : ''}`}
          role="tablist"
          aria-label="Filter voting record"
        >
          {visibleFilters.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              aria-controls="voting-record-panel"
              tabIndex={filter === f.key ? 0 : -1}
              ref={(el) => { tabRefs.current[f.key] = el }}
              data-filter={f.key}
              className={`${styles.filterBtn} ${filter === f.key ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(f.key)}
              onKeyDown={(e) => handleKeyDown(e, f.key)}
            >
              {f.label}
              <span className={styles.filterCount}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <p className={styles.voteCount} aria-live="polite" aria-atomic="true">
        <span><strong>{filteredVotes.length}</strong> vote{filteredVotes.length !== 1 ? 's' : ''}</span>
        {filter !== 'ALL' && (
          <span className={`${styles.filterPill} ${styles[`filterPill${filter}`]}`}>
            {filter === 'NO_SHOW' ? 'No show' : filter === 'ABSTAINED' ? 'Abstain' : filter.charAt(0) + filter.slice(1).toLowerCase()}
          </span>
        )}
      </p>

      <div
        id="voting-record-panel"
        role="tabpanel"
        aria-labelledby="voting-record-heading"
      >
        {/* Desktop table */}
        <div className={`${styles.tableWrap} ${styles.desktopTable}`}>
          <table
            className={styles.table}
            aria-label={`Voting record for ${memberName}`}
          >
            <colgroup>
              <col className={styles.colSubject} />
              <col className={styles.colVote} />
              <col className={styles.colResult} />
              <col className={`${styles.colDate} ${styles.dateCol}`} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Division</th>
                <th scope="col" className={styles.voteHeader}>Vote</th>
                <th scope="col" className={styles.resultCol}>Result</th>
                <th scope="col" className={styles.dateCell}>Date</th>
              </tr>
            </thead>
            <tbody>
              {visibleVotes.map((h, i) => {
                const voteLabel =
                  h.vote === 'AYE'       ? 'Aye' :
                  h.vote === 'NO'        ? 'No' :
                  h.vote === 'ABSTAINED' ? 'Abstain' :
                  h.vote === 'NO_SHOW'   ? 'No Show' : null

                const voteCls =
                  h.vote === 'AYE'       ? 'vote-aye' :
                  h.vote === 'NO'        ? 'vote-no' :
                  h.vote === 'ABSTAINED' ? 'vote-abstain' :
                  'vote-noshow'

                const passed = isPassed(h.outcome)
                const isEven = i % 2 === 1
                const raw = h.title ?? h.subject
                const { title, subtitle } = formatDivisionSubject(raw)
                return (
                  <tr
                    key={`${filter}-${h.documentId}`}
                    className={[
                      styles.voteRow,
                      isEven ? styles.rowEven : '',
                      h.vote === 'NO_SHOW' ? styles.voteNoShow : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <td className={styles.subjectCell}>
                      <Link
                        href={`/assembly/divisions/${h.documentId}`}
                        aria-label={`View division: ${title}`}
                      >
                        <span className={styles.subjectTitle}>{title}</span>
                        {subtitle && (
                          <span className={styles.subjectSubtitle}>{subtitle}</span>
                        )}
                      </Link>
                    </td>
                    <td className={styles.voteCell}>
                      {voteLabel && (
                        <span className={`vote-pill ${voteCls}`}>{voteLabel}</span>
                      )}
                    </td>
                    <td className={styles.resultCell}>
                      {passed !== null && (
                        <span
                          className={styles.outcomeDot}
                          data-passed={passed}
                          role="img"
                          aria-label={passed ? 'Passed' : 'Failed'}
                        />
                      )}
                    </td>
                    <td className={styles.dateCell}>{formatDate(h.divisionDate.toISOString())}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className={styles.mobileCards}>
          {visibleVotes.map((h) => {
            const voteLabel =
              h.vote === 'AYE'       ? 'Aye' :
              h.vote === 'NO'        ? 'No' :
              h.vote === 'ABSTAINED' ? 'Abstain' :
              h.vote === 'NO_SHOW'   ? 'No Show' : null

            const voteCls =
              h.vote === 'AYE'       ? 'vote-aye' :
              h.vote === 'NO'        ? 'vote-no' :
              h.vote === 'ABSTAINED' ? 'vote-abstain' :
              'vote-noshow'

            const passed = isPassed(h.outcome)
            const raw = h.title ?? h.subject
            const { title, subtitle } = formatDivisionSubject(raw)
            return (
              <Link
                key={`mobile-${filter}-${h.documentId}`}
                href={`/assembly/divisions/${h.documentId}`}
                className={styles.mobileCard}
              >
                <div className={styles.mobileTitle}>{title}</div>
                {subtitle && (
                  <div className={styles.mobileSub}>{subtitle}</div>
                )}
                <div className={styles.mobileMeta}>
                  <div className={styles.mobilePills}>
                    {voteLabel && (
                      <span className={styles.mobilePillGroup}>
                        <span className={styles.mobilePillLabel}>Vote</span>
                        <span className={`vote-pill ${voteCls}`}>{voteLabel}</span>
                      </span>
                    )}
                    {passed !== null && (
                      <span className={styles.mobilePillGroup}>
                        <span className={styles.mobilePillLabel}>Result</span>
                        <span className={passed ? styles.outcomePass : styles.outcomeFail}>
                          {passed ? 'Passed' : 'Failed'}
                        </span>
                      </span>
                    )}
                  </div>
                  <span className={styles.mobileDate}>{formatDate(h.divisionDate.toISOString())}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {hasMore && (
        <button
          className={styles.loadMore}
          onClick={() => setVisibleCount(c => c + 50)}
        >
          Load more ({filteredVotes.length - visibleCount} remaining)
        </button>
      )}
    </section>
  )
}
