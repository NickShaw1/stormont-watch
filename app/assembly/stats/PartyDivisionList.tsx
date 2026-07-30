'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FileText, Scale, Megaphone } from 'lucide-react'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { isPassed } from '@/lib/bills'
import { useMandate } from '@/components/MandateContext'
import type { AgreedDivisionRow } from '@/lib/db/queries'
import styles from './stats.module.css'

type Filter = 'ALL' | 'MATCHED' | 'AGAINST'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'MATCHED', label: 'Matched the result' },
  { key: 'AGAINST', label: 'Against the result' },
]

const VOTE_LABEL: Record<AgreedDivisionRow['sharedVote'], string> = {
  AYE: 'Aye',
  NO: 'No',
  ABSTAINED: 'Abstain',
  NO_SHOW: 'No Show',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function overallResultLabel(passed: boolean | null): 'Passed' | 'Failed' | 'Unknown' {
  if (passed === null) return 'Unknown'
  return passed ? 'Passed' : 'Failed'
}

interface Props {
  partyA: string
  partyB: string
  divisions: AgreedDivisionRow[]
  basePath?: string
}

export default function PartyDivisionList({ partyA, partyB, divisions, basePath = '' }: Props) {
  const { basePath: mandateBasePath } = useMandate()
  const effectiveBasePath = basePath || mandateBasePath
  const [filter, setFilter] = useState<Filter>('ALL')
  const tabRefs = useRef<Record<Filter, HTMLButtonElement | null>>({ ALL: null, MATCHED: null, AGAINST: null })

  // Mobile-only dropdown, same shape as the expenses year picker / MLA voting-record filter.
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

  const matchedCount = divisions.filter(d => d.wonOverall).length
  const againstCount = divisions.length - matchedCount
  const matchedPct = divisions.length > 0 ? Math.round((matchedCount / divisions.length) * 100) : 0

  const voteBreakdown = {
    AYE: divisions.filter(d => d.sharedVote === 'AYE').length,
    NO: divisions.filter(d => d.sharedVote === 'NO').length,
    ABSTAINED: divisions.filter(d => d.sharedVote === 'ABSTAINED').length,
    NO_SHOW: divisions.filter(d => d.sharedVote === 'NO_SHOW').length,
  }

  const counts: Record<Filter, number> = {
    ALL: divisions.length,
    MATCHED: matchedCount,
    AGAINST: againstCount,
  }
  const visibleFilters = FILTERS.filter(f => f.key === 'ALL' || counts[f.key] > 0)
  const activeFilter = FILTERS.find(f => f.key === filter)!

  const filtered = filter === 'ALL' ? divisions : divisions.filter(d => (filter === 'MATCHED' ? d.wonOverall : !d.wonOverall))
  const sorted = [...filtered].sort((a, b) => b.divisionDate.getTime() - a.divisionDate.getTime())

  function handleKeyDown(e: React.KeyboardEvent, currentKey: Filter) {
    const keys = visibleFilters.map(f => f.key)
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
    <div>
      <div className={styles.divSummaryStrip}>
        <div className={styles.divSummaryCell}>
          <span className={styles.divSummaryCellValue}>{matchedPct}%</span>
          <p className={styles.divSummaryCellCaption}>
            The winning side matched {partyA} and {partyB}&apos;s position on <strong>{matchedCount}</strong> of{' '}
            <strong>{divisions.length}</strong> occasion{matchedCount === 1 ? '' : 's'}.
          </p>
        </div>
        <div className={styles.divVoteBreakdown}>
          <div className={`${styles.divVoteBreakdownCell} ${styles.divVoteBreakdownAye}`}>
            <span className={styles.divVoteBreakdownValue}>{voteBreakdown.AYE}</span>
            <span className={styles.divVoteBreakdownLabel}>Both Aye</span>
          </div>
          <div className={`${styles.divVoteBreakdownCell} ${styles.divVoteBreakdownNo}`}>
            <span className={styles.divVoteBreakdownValue}>{voteBreakdown.NO}</span>
            <span className={styles.divVoteBreakdownLabel}>Both No</span>
          </div>
          <div className={`${styles.divVoteBreakdownCell} ${styles.divVoteBreakdownNeutral}`}>
            <span className={styles.divVoteBreakdownValue}>{voteBreakdown.ABSTAINED}</span>
            <span className={styles.divVoteBreakdownLabel}>Both Abstain</span>
          </div>
          <div className={`${styles.divVoteBreakdownCell} ${styles.divVoteBreakdownNeutral}`}>
            <span className={styles.divVoteBreakdownValue}>{voteBreakdown.NO_SHOW}</span>
            <span className={styles.divVoteBreakdownLabel}>Both No Show</span>
          </div>
        </div>
      </div>

      <div className={styles.divFilters} role="tablist" aria-label="Filter divisions">
        {visibleFilters.map(f => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            aria-controls="agreed-divisions-panel"
            tabIndex={filter === f.key ? 0 : -1}
            ref={(el) => { tabRefs.current[f.key] = el }}
            data-filter={f.key}
            className={`${styles.divFilterBtn} ${filter === f.key ? styles.divFilterBtnActive : ''}`}
            onClick={() => setFilter(f.key)}
            onKeyDown={(e) => handleKeyDown(e, f.key)}
          >
            {f.label}
            <span className={styles.divFilterCount}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className={styles.divFilterDropdownWrap} ref={filterDropdownRef}>
        <button
          type="button"
          className={styles.divFilterTrigger}
          onClick={() => setFilterDropdownOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={filterDropdownOpen}
          aria-label={`Filter divisions, currently ${activeFilter.label}`}
        >
          <span>{activeFilter.label} ({counts[activeFilter.key]})</span>
          <svg
            className={`${styles.divFilterChevron} ${filterDropdownOpen ? styles.divFilterChevronOpen : ''}`}
            width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
          >
            <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        {filterDropdownOpen && (
          <ul className={styles.divFilterDropdownList} role="listbox">
            {visibleFilters.map(f => (
              <li
                key={f.key}
                role="option"
                tabIndex={0}
                aria-selected={filter === f.key}
                className={`${styles.divFilterDropdownItem} ${filter === f.key ? styles.divFilterDropdownItemSelected : ''}`}
                onClick={() => { setFilter(f.key); setFilterDropdownOpen(false) }}
              >
                {f.label} ({counts[f.key]})
              </li>
            ))}
          </ul>
        )}
      </div>

      <div id="agreed-divisions-panel" role="tabpanel" className={styles.divRowList}>
        {sorted.length === 0 && <p className={styles.divRowEmpty}>No divisions match this filter.</p>}
        {sorted.map((d) => {
          const raw = d.title ?? d.subject
          const { title } = formatDivisionSubject(raw)
          const result = overallResultLabel(isPassed(d.outcome))
          const day = d.divisionDate.getDate()
          const month = MONTHS[d.divisionDate.getMonth()]
          const year = d.divisionDate.getFullYear()

          const t = d.title ?? ''
          const s = d.subject ?? ''
          const isStatutory = /^The draft /i.test(t) || /^Prayer of Annulment:/i.test(t) || /^Applicability Motion/i.test(t)
          const isBill = !isStatutory && (/NIA Bill/i.test(s) || /(?:First|Second|Committee|Consideration|Further Consideration|Final) Stage:/i.test(s))
          const category = isStatutory ? 'SR' : isBill ? 'Bill' : 'Motion'
          const CategoryIcon = isStatutory ? FileText : isBill ? Scale : Megaphone
          const categoryCls = isStatutory ? styles.divCategorySr : isBill ? styles.divCategoryBill : styles.divCategoryMotion

          return (
            <Link
              key={d.documentId}
              href={`${effectiveBasePath}/assembly/divisions/${d.documentId}`}
              className={styles.divRow}
            >
              <span className={styles.divDate}>{day} {month} {year}</span>
              <span className={`${styles.divCategoryPill} ${categoryCls}`} title={isStatutory ? 'Statutory Rules' : category}>
                <CategoryIcon size={12} strokeWidth={2} aria-hidden="true" />
                {category}
              </span>
              <span className={styles.divRowTitle}><span className={styles.divRowTitleText}>{title}</span></span>
              <span className={styles.divRowMetaSep} aria-hidden="true" />
              <span className={styles.divRowVotePair}>
                <span className={styles.divRowVoteLabel}>{partyA} &amp; {partyB} voted:</span>
                <span className={styles.divRowSharedVote}>{VOTE_LABEL[d.sharedVote]}</span>
              </span>
              <span className={styles.divRowMetaSep} aria-hidden="true" />
              <span
                className={`${styles.divRowResultPill} ${result === 'Passed' ? styles.divRowResultPillPass : result === 'Failed' ? styles.divRowResultPillFail : styles.divRowResultPillUnknown}`}
              >
                {result}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
