'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { formatMonthGroup, monthKey } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import styles from './votes.module.css'

function getBaseTitle(rawTitle: string): string {
  // Trailing suffix: "Title - Amendment N"
  const stripped = rawTitle.replace(/ - Amendment \d+$/i, '').trim()
  if (stripped !== rawTitle) return stripped

  // Bill amendment prefix: "Amendment N - Stage: Bill Title ..."
  if (/^(Amendment|Clause)\s+\d+\s+-\s+/i.test(rawTitle)) {
    const { title } = formatDivisionSubject(rawTitle)
    if (title && title !== rawTitle) return title
  }

  return rawTitle
}

function getAmendmentNumber(rawTitle: string): number | null {
  const m = rawTitle.match(/ - Amendment (\d+)$/i)
  return m ? parseInt(m[1], 10) : null
}

interface DivisionGroup {
  baseTitle: string
  mainItem: VoteItem
  items: VoteItem[]
}

function buildGroups(items: VoteItem[]): DivisionGroup[] {
  const map = new Map<string, VoteItem[]>()
  for (const item of items) {
    const base = getBaseTitle(item.rawTitle ?? item.subject)
    const key = item.isStatutory === true
      ? `__statutory__${item.key}`
      : item.isBill === true
        ? `${base}|${item.latestDate.slice(0, 10)}`
        : base
    const bucket = map.get(key) ?? []
    bucket.push(item)
    map.set(key, bucket)
  }
  return Array.from(map.entries()).map(([, divItems]) => {
    const sorted = [...divItems].sort((a, b) => {
      const an = getAmendmentNumber(a.rawTitle ?? a.subject)
      const bn = getAmendmentNumber(b.rawTitle ?? b.subject)
      if (an === null && bn === null) return 0
      if (an === null) return -1
      if (bn === null) return 1
      return an - bn
    })
    const mainItem = sorted.find(i => getAmendmentNumber(i.rawTitle ?? i.subject) === null) ?? sorted[0]
    const baseTitle = getBaseTitle(mainItem.rawTitle ?? mainItem.subject)
    return { baseTitle, mainItem, items: sorted }
  })
}

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
  isStatutory?: boolean
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
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BILLS' | 'MOTIONS' | 'REGULATIONS'>('ALL')
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)

  const years = Array.from(new Set(allItems.map(i => i.latestDate.slice(0, 4)))).sort((a, b) => b.localeCompare(a))
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
  }, [yearFilter, resultFilter, typeFilter, debouncedQuery])

  const filteredItems = allItems
    .filter(item => yearFilter === 'ALL' || item.latestDate.slice(0, 4) === yearFilter)
    .filter(item => {
      if (resultFilter === 'ALL') return true
      if (resultFilter === 'PASSED') return item.passed === true
      if (resultFilter === 'FAILED') return item.passed === false
      return true
    })
    .filter(item => {
      if (typeFilter === 'ALL') return true
      if (typeFilter === 'BILLS') return item.isBill === true
      if (typeFilter === 'MOTIONS') return !item.isBill && !item.isStatutory
      if (typeFilter === 'REGULATIONS') return item.isStatutory === true
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
          className={`${styles.filterBtn} ${styles.filterBtnAll} ${yearFilter === 'ALL' && resultFilter === 'ALL' && typeFilter === 'ALL' ? styles.filterBtnActive : ''}`}
          onClick={() => { setYearFilter('ALL'); setResultFilter('ALL'); setTypeFilter('ALL') }}
          aria-pressed={yearFilter === 'ALL' && resultFilter === 'ALL' && typeFilter === 'ALL'}
        >
          All
        </button>
        <div role="group" aria-label="Filter by year" className={styles.yearFilters}>
          {years.map((y) => (
            <button
              key={y}
              aria-pressed={yearFilter === y}
              className={`${styles.filterBtn} ${yearFilter === y ? styles.filterBtnActive : ''}`}
              onClick={() => setYearFilter(y)}
            >
              {y}
            </button>
          ))}
        </div>
        <div className={`${styles.filterDivider} ${styles.yearDivider}`} aria-hidden="true" />
        <div role="group" aria-label="Filter by type" className={styles.resultGroup}>
          <button
            aria-pressed={typeFilter === 'BILLS'}
            className={`${styles.filterBtn} ${typeFilter === 'BILLS' ? styles.filterBtnActive : ''}`}
            onClick={() => setTypeFilter(f => f === 'BILLS' ? 'ALL' : 'BILLS')}
          >
            Bills
          </button>
          <button
            aria-pressed={typeFilter === 'MOTIONS'}
            className={`${styles.filterBtn} ${typeFilter === 'MOTIONS' ? styles.filterBtnActive : ''}`}
            onClick={() => setTypeFilter(f => f === 'MOTIONS' ? 'ALL' : 'MOTIONS')}
          >
            Motions
          </button>
          <button
            aria-pressed={typeFilter === 'REGULATIONS'}
            className={`${styles.filterBtn} ${typeFilter === 'REGULATIONS' ? styles.filterBtnActive : ''}`}
            onClick={() => setTypeFilter(f => f === 'REGULATIONS' ? 'ALL' : 'REGULATIONS')}
          >
            Regulations
          </button>
        </div>
        <div className={styles.filterDivider} aria-hidden="true" />
        <div role="group" aria-label="Filter by outcome" className={styles.resultGroup}>
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
          <section className={styles.monthSection} aria-label={`${group.label} — ${group.totalCount} division${group.totalCount !== 1 ? 's' : ''}`}>
            <h2 className={styles.monthHeading}>
              {group.label}
              <span className={styles.monthCount} aria-hidden="true">{group.totalCount}</span>
            </h2>
            <div className={styles.divList}>
              {buildGroups(group.items).map((g) => {
                const { mainItem, baseTitle, items: divItems } = g
                const d = new Date(mainItem.latestDate)
                const day = d.getDate()
                const monthYear = `${d.toLocaleString('en', { month: 'short' }).toUpperCase()} · ${d.getFullYear()}`
                return (
                  <div key={g.baseTitle} className={`${styles.divRow} ${styles.divGrouped}`}>
                    <div className={styles.divDate}>
                      <strong className={styles.divDay}>{day}</strong>
                      <span className={styles.divMonthYear}>{monthYear}</span>
                    </div>
                    <div className={styles.divMain}>
                      <div className={styles.divTitle}>{formatDivisionSubject(baseTitle).title}</div>
                      {(mainItem.isBill || mainItem.isCrossCommunity || mainItem.isStatutory) && (
                        <div className={styles.divSub}>
                          {mainItem.isBill && <span className={styles.billTag}>Bill</span>}
                          {mainItem.isStatutory && <span className={styles.srPill}>Statutory Rules</span>}
                          {mainItem.isCrossCommunity && <span className={styles.flexBreak} />}
                          {mainItem.isCrossCommunity && <span className={styles.xcPill}>Cross-community</span>}
                        </div>
                      )}
                      <div className={styles.divOutcomeList}>
                        {divItems.map((item) => {
                          const amendNum = getAmendmentNumber(item.rawTitle ?? item.subject)
                          const { subtitle: itemSubtitle } = formatDivisionSubject(item.rawTitle ?? item.subject)
                          const label = amendNum !== null ? `Amendment ${amendNum}` : (itemSubtitle ?? 'Motion')
                          const ayes = item.totalAyes ?? 0
                          const noes = item.totalNoes ?? 0
                          const total = ayes + noes
                          const ayePct = total > 0 ? (ayes / total) * 100 : 50
                          const noePct = total > 0 ? (noes / total) * 100 : 50
                          return (
                            <Link key={item.key} href={item.href} className={styles.divOutcomeRow}>
                              <span className={styles.divOutcomeLabel}>{label}</span>

                              {total > 0 && (
                                <div className={styles.divOutcomeBar}>
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
                              {item.passed === true && <span className="pill pass">Passed</span>}
                              {item.passed === false && <span className="pill fail">Failed</span>}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </React.Fragment>
      ))}

      {hasMore && (
        <button
          className={styles.loadMore}
          onClick={() => setVisibleCount(c => c + 50)}
        >
          Load more ({filteredItems.length - visibleCount} remaining)
        </button>
      )}
    </div>
  )
}
