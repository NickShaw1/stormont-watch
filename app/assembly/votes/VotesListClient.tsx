'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { formatMonthGroup, monthKey } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import styles from './votes.module.css'

export interface VoteItem {
  key: string
  href: string
  rawTitle: string | null
  subject: string
  latestDate: string
  passed: boolean | null
  motionText?: string | null
  isCrossCommunity?: boolean
  isBill?: boolean
  totalAyes?: number | null
  totalNoes?: number | null
}

interface Props {
  allItems: VoteItem[]
}

const ITEMS_PER_PAGE = 30

export default function VotesListClient({ allItems }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [yearFilter, setYearFilter] = useState('ALL')
  const [resultFilter, setResultFilter] = useState<'ALL' | 'PASSED' | 'FAILED'>('ALL')
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDebouncedQuery(val), 150)
  }

  const q = debouncedQuery.toLowerCase().trim()

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE)
  }, [yearFilter, resultFilter, debouncedQuery])

  const filteredItems = allItems
    .filter(item => yearFilter === 'ALL' || new Date(item.latestDate).getFullYear().toString() === yearFilter)
    .filter(item => {
      if (resultFilter === 'ALL') return true
      if (resultFilter === 'PASSED') return item.passed === true
      if (resultFilter === 'FAILED') return item.passed === false
      return true
    })
    .filter(item => !q || formatDivisionSubject(item.rawTitle ?? item.subject).title.toLowerCase().includes(q))

  const visibleItems = filteredItems.slice(0, visibleCount)
  const hasMore = visibleCount < filteredItems.length

  const totalByMonth = new Map<string, number>()
  for (const item of filteredItems) {
    const key = monthKey(item.latestDate)
    totalByMonth.set(key, (totalByMonth.get(key) ?? 0) + 1)
  }

  const byMonth = new Map<string, VoteItem[]>()
  for (const item of visibleItems) {
    const key = monthKey(item.latestDate)
    const group = byMonth.get(key) ?? []
    group.push(item)
    byMonth.set(key, group)
  }
  const monthGroups = Array.from(byMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({
      label: formatMonthGroup(items[0].latestDate),
      items,
      totalCount: totalByMonth.get(key) ?? items.length,
    }))

  return (
    <div>
      {/* Filters */}
      <div className={styles.filterRow}>
        <button
          className={`${styles.filterBtn} ${yearFilter === 'ALL' && resultFilter === 'ALL' ? styles.filterBtnActive : ''}`}
          onClick={() => { setYearFilter('ALL'); setResultFilter('ALL') }}
          aria-pressed={yearFilter === 'ALL' && resultFilter === 'ALL'}
        >
          All
        </button>
        {(['2026', '2025', '2024'] as const).map((y) => (
          <button
            key={y}
            aria-pressed={yearFilter === y}
            className={`${styles.filterBtn} ${yearFilter === y ? styles.filterBtnActive : ''}`}
            onClick={() => setYearFilter(y)}
          >
            {y}
          </button>
        ))}
        <div className={styles.filterDivider} aria-hidden="true" />
        <div className={styles.resultGroup}>
          <button
            aria-pressed={resultFilter === 'PASSED'}
            className={`${styles.filterBtn} ${resultFilter === 'PASSED' ? styles.filterBtnActive : ''}`}
            data-filter="PASSED"
            onClick={() => setResultFilter(r => r === 'PASSED' ? 'ALL' : 'PASSED')}
          >
            Passed
          </button>
          <button
            aria-pressed={resultFilter === 'FAILED'}
            className={`${styles.filterBtn} ${resultFilter === 'FAILED' ? styles.filterBtnActive : ''}`}
            data-filter="FAILED"
            onClick={() => setResultFilter(r => r === 'FAILED' ? 'ALL' : 'FAILED')}
          >
            Failed
          </button>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <label htmlFor="vote-search" className="sr-only">Search votes</label>
        <input
          id="vote-search"
          type="search"
          placeholder="Search divisions…"
          value={query}
          onChange={handleSearch}
          className={styles.search}
        />
      </div>

      {/* Result count */}
      <p className={styles.resultCount}>
        <strong>{filteredItems.length}</strong> division{filteredItems.length !== 1 ? 's' : ''}
        {yearFilter !== 'ALL' ? ` in ${yearFilter}` : <> since <strong>May 2022</strong></>}
        {q ? ` matching "${q}"` : ''}
      </p>

      {filteredItems.length === 0 && (
        <p className={styles.emptyState}>No divisions match your search.</p>
      )}

      {monthGroups.map((group) => (
        <React.Fragment key={group.label}>
          <hr className={styles.monthRule} />
          <section className={styles.monthSection} aria-labelledby={`month-${group.label.replace(/\s+/g, '-')}`}>
            <h2 id={`month-${group.label.replace(/\s+/g, '-')}`} className={styles.monthHeading}>
              {group.label}
              <span className={styles.monthCount}>{group.totalCount}</span>
            </h2>
            <div className={styles.divList}>
              {group.items.map((item) => {
                const { title: displayTitle, subtitle } = formatDivisionSubject(item.rawTitle ?? item.subject)
                const d = new Date(item.latestDate)
                const day = d.getDate()
                const monthYear = `${d.toLocaleString('en', { month: 'short' }).toUpperCase()} · ${d.getFullYear()}`
                const ayes = item.totalAyes ?? 0
                const noes = item.totalNoes ?? 0
                const total = ayes + noes
                const ayePct = total > 0 ? (ayes / total) * 100 : 50
                const noePct = total > 0 ? (noes / total) * 100 : 50

                return (
                  <Link key={item.key} href={item.href} className={`${styles.divRow} ${item.isBill ? styles.divRowBill : ''}`}>
                    <div className={styles.divDate}>
                      <strong className={styles.divDay}>{day}</strong>
                      <span className={styles.divMonthYear}>{monthYear}</span>
                    </div>
                    <div className={styles.divMain}>
                      <div className={styles.divTitle}>{displayTitle}</div>
                      {(subtitle || item.isBill || item.isCrossCommunity) && (
                        <div className={styles.divSub}>
                          {item.isBill && <span className={styles.billTag}>Bill</span>}
                          {subtitle}
                          {item.isCrossCommunity && <span className={styles.flexBreak} />}
                          {item.isCrossCommunity && <span className={styles.xcPill}>Cross-community</span>}
                        </div>
                      )}
                    </div>
                    {total > 0 && (
                      <div className={styles.divBarCol}>
                        <div className={styles.divBarTrack}>
                          <div className={styles.divBarAye} style={{ width: `${ayePct}%` }} />
                          <div className={styles.divBarNo} style={{ width: `${noePct}%` }} />
                        </div>
                        <div className={styles.divCounts}>
                          <span className={styles.divCountAye}>AYE {ayes}</span>
                          <span className={styles.divCountNo}>NO {noes}</span>
                        </div>
                      </div>
                    )}
                    {item.passed === true && <span className="pill pass" style={{ alignSelf: 'center' }}>Passed</span>}
                    {item.passed === false && <span className="pill fail" style={{ alignSelf: 'center' }}>Failed</span>}
                  </Link>
                )
              })}
            </div>
          </section>
        </React.Fragment>
      ))}

      {hasMore && (
        <button
          className={styles.loadMore}
          onClick={() => setVisibleCount(c => c + ITEMS_PER_PAGE)}
        >
          Load more ({filteredItems.length - visibleCount} remaining)
        </button>
      )}
    </div>
  )
}
