'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Vote, FileText, Scale, Megaphone, PenLine } from 'lucide-react'
import { isPassed } from '@/lib/bills'
import { formatDate } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { useMandate } from '@/components/MandateContext'
import BillStagePill from '@/app/components/BillStagePill'
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
  noExpensesTab?: boolean
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL',      label: 'All' },
  { key: 'AYE',      label: 'Aye' },
  { key: 'NO',       label: 'No' },
  { key: 'NO_SHOW',  label: 'No Show' },
  { key: 'ABSTAINED', label: 'Abstain' },
]


export default function VotingRecordClient({ votes, noExpensesTab }: Props) {
  const { basePath } = useMandate()
  const [filter, setFilter] = useState<Filter>('ALL')
  const filteredVotes = filter === 'ALL' ? votes : votes.filter((v) => v.vote === filter)

  const visibleVotes = filteredVotes

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

  // Mobile-only dropdown, same shape as the expenses year picker.
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const filterDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!filterDropdownOpen) return
    function onOutside(e: MouseEvent) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [filterDropdownOpen])

  const activeFilter = FILTERS.find((f) => f.key === filter)!

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
        <div className={`${styles.sectionHead}${noExpensesTab ? ` ${styles.noExpensesTop}` : ''}`}>
          <span className={styles.sectionEyebrow}>This MLA</span>
          <h2 id="voting-record-heading" className={styles.sectionHeading}>
            <Vote className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Voting record
          </h2>
        </div>
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

        <div
          className={`${styles.voteFilterDropdownWrap}${noExpensesTab ? ` ${styles.noExpensesTop}` : ''}`}
          ref={filterDropdownRef}
        >
          <button
            type="button"
            className={styles.expensesYearTrigger}
            onClick={() => setFilterDropdownOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={filterDropdownOpen}
            aria-label={`Filter voting record, currently ${activeFilter.label}`}
          >
            <span>{activeFilter.label} ({counts[activeFilter.key]})</span>
            <svg
              className={`${styles.expensesYearChevron} ${filterDropdownOpen ? styles.expensesYearChevronOpen : ''}`}
              width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
            >
              <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          {filterDropdownOpen && (
            <ul className={styles.expensesYearDropdownList} role="listbox">
              {visibleFilters.map((f) => (
                <li
                  key={f.key}
                  role="option"
                  tabIndex={0}
                  aria-selected={filter === f.key}
                  className={`${styles.expensesYearDropdownItem} ${filter === f.key ? styles.expensesYearDropdownItemSelected : ''}`}
                  onClick={() => { setFilter(f.key); setFilterDropdownOpen(false) }}
                >
                  {f.label} ({counts[f.key]})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <span className={styles.voteCountSr} role="status" aria-live="polite" aria-atomic="true">
        {filteredVotes.length} vote{filteredVotes.length !== 1 ? 's' : ''}
      </span>

      <div
        id="voting-record-panel"
        role="tabpanel"
        aria-labelledby="voting-record-heading"
        className={styles.voteRowList}
      >
        {visibleVotes.map((h) => {
          const voteLabel =
            h.vote === 'AYE'       ? 'Aye' :
            h.vote === 'NO'        ? 'No' :
            h.vote === 'ABSTAINED' ? 'Abstain' :
            h.vote === 'NO_SHOW'   ? 'No Show' : null

          const voteChipCls =
            h.vote === 'AYE'       ? styles.voteChipAYE :
            h.vote === 'NO'        ? styles.voteChipNO :
            h.vote === 'ABSTAINED' ? styles.voteChipABSTAINED :
            styles.voteChipNO_SHOW
          const passed = isPassed(h.outcome)
          const raw = h.title ?? h.subject
          const { title, subtitle, stage } = formatDivisionSubject(raw)

          // Amendment label becomes a chip instead of plain caption text.
          const amendmentMatch = subtitle?.match(/^Amendment (\d+)$/)
          const stageText = stage

          // Same category derivation as the homepage's Recent Divisions.
          const t = h.title ?? ''
          const s = h.subject ?? ''
          const isStatutory = /^The draft /i.test(t) || /^Prayer of Annulment:/i.test(t) || /^Applicability Motion/i.test(t)
          const isBill = !isStatutory && (/NIA Bill/i.test(s) || /(?:First|Second|Committee|Consideration|Further Consideration|Final) Stage:/i.test(s))
          const category = isStatutory ? 'Regulations' : isBill ? 'Bill' : 'Motion'
          const CategoryIcon = isStatutory ? FileText : isBill ? Scale : Megaphone
          const categoryCls = isStatutory ? styles.chipRegulations : isBill ? styles.chipBill : styles.chipMotion

          return (
            <Link
              key={`${filter}-${h.documentId}`}
              href={`${basePath}/assembly/divisions/${h.documentId}`}
              className={styles.voteRow}
              aria-label={`View division: ${title}`}
            >
              <div className={styles.voteRowMain}>
                <span className={styles.voteRowTitle}>{title}</span>
                <div className={styles.voteRowChips}>
                  <span className={`${styles.divChip} ${categoryCls}`}>
                    <CategoryIcon size={12} strokeWidth={2} aria-hidden="true" />
                    {category}
                  </span>
                  {stageText && (
                    <BillStagePill category="in-progress" currentStage={stageText} passed={null} />
                  )}
                  {amendmentMatch && (
                    <span className={`${styles.divChip} ${styles.chipAmendment}`}>
                      <PenLine size={12} strokeWidth={2} aria-hidden="true" />
                      Amendment {amendmentMatch[1]}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.voteRowMeta}>
                {(voteLabel || passed !== null) && (
                  <span className={styles.voteOutcomeLine}>
                    {voteLabel && (
                      <span className={styles.voteOutcomePair}>
                        <span className={styles.voteOutcomeLabel}>Voted</span>
                        <span className={voteChipCls}>{voteLabel}</span>
                      </span>
                    )}
                    {voteLabel && passed !== null && <span className={styles.voteOutcomeSep}>&middot;</span>}
                    {passed !== null && (
                      <span className={styles.voteOutcomePair}>
                        <span className={styles.voteOutcomeLabel}>Result</span>
                        <span className={passed ? styles.voteOutcomePass : styles.voteOutcomeFail}>
                          {passed ? 'Passed' : 'Failed'}
                        </span>
                      </span>
                    )}
                  </span>
                )}
                <span className={styles.voteRowDateCaption}>{formatDate(h.divisionDate.toISOString())}</span>
              </div>
            </Link>
          )
        })}
      </div>

    </section>
  )
}
