'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/format'
import { isPassed } from '@/lib/bills'
import type { BillItem } from './page'
import styles from './bills.module.css'

interface ThisWeekBill {
  bill_id: string
  short_title: string
  bill_type: string | null
  stage: string
  plenary_date: string
  has_division: boolean
  outcome: string | null
}

interface Props {
  scheduled: BillItem[]
  inProgress: BillItem[]
  completed: BillItem[]
  thisWeekBills: ThisWeekBill[]
}

const tabs = ['scheduled', 'in-progress', 'completed'] as const
type Tab = typeof tabs[number]

const BILL_STAGES = [
  'Introduction',
  'First Stage',
  'Second Stage',
  'Committee Stage',
  'Consideration Stage',
  'Further Consideration Stage',
  'Final Stage',
  'Royal Assent',
]

function getStageIdx(currentStage: string, royalAssentDate: string | null): number {
  if (royalAssentDate) return BILL_STAGES.length - 1
  const lower = currentStage.toLowerCase()
  let best = 0
  for (let i = 0; i < BILL_STAGES.length; i++) {
    if (lower.includes(BILL_STAGES[i].toLowerCase())) best = i
  }
  return best
}

function formatBillNum(billId: string): { main: string; session: string } {
  const idx = billId.lastIndexOf('/')
  if (idx === -1) return { main: billId, session: '' }
  return { main: billId.slice(0, idx), session: billId.slice(idx + 1) }
}

export default function BillsListClient({ scheduled, inProgress, completed, thisWeekBills }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('scheduled')
  const [previousTab, setPreviousTab] = useState<Tab>('scheduled')
  const [isSearching, setIsSearching] = useState(false)
  const [yearFilter, setYearFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(20)

  const years = ['ALL', ...Array.from(new Set(
    completed.map(b => new Date(b.latestDate).getFullYear().toString())
  )).sort((a, b) => Number(b) - Number(a))]

  const q = searchQuery.toLowerCase()

  const filteredScheduled = isSearching
    ? scheduled.filter(b => b.title.toLowerCase().includes(q))
    : scheduled

  const filteredInProgress = isSearching
    ? inProgress.filter(b => b.title.toLowerCase().includes(q))
    : inProgress

  const filteredCompleted = isSearching
    ? completed.filter(b => b.title.toLowerCase().includes(q))
    : completed.filter(b => yearFilter === 'ALL' || new Date(b.latestDate).getFullYear().toString() === yearFilter)

  const visibleCompleted = filteredCompleted.slice(0, visibleCount)
  const hasMore = visibleCount < filteredCompleted.length

  const allEmpty = isSearching && filteredScheduled.length === 0 && filteredInProgress.length === 0 && filteredCompleted.length === 0

  const showScheduled = isSearching ? filteredScheduled.length > 0 || allEmpty : activeTab === 'scheduled'
  const showInProgress = isSearching ? filteredInProgress.length > 0 || allEmpty : activeTab === 'in-progress'
  const showCompleted = isSearching ? filteredCompleted.length > 0 || allEmpty : activeTab === 'completed'

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    setVisibleCount(20)
    if (!isSearching) setPreviousTab(tab)
  }

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    setVisibleCount(20)
    if (value.trim().length > 0) {
      setIsSearching(true)
    } else {
      setIsSearching(false)
      setActiveTab(previousTab)
    }
  }

  const monday = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return d
  })()
  const mondayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(monday)

  const BillRow = ({ bill }: { bill: BillItem }) => {
    const { main, session } = formatBillNum(bill.billId)
    const stageIdx = getStageIdx(bill.currentStage, bill.royalAssentDate)
    const progress = Math.round((stageIdx / (BILL_STAGES.length - 1)) * 100)

    const becameLaw = bill.category === 'completed' && bill.passed === true && bill.royalAssentDate

    const pillClass =
      bill.category === 'completed'
        ? bill.passed === true ? 'pass' : bill.passed === false ? 'fail' : 'neutral'
        : bill.category === 'scheduled' ? 'accent' : 'neutral'

    const pillLabel =
      bill.category === 'completed'
        ? bill.passed === true ? 'Became law' : bill.passed === false ? 'Failed' : 'Completed'
        : bill.category === 'scheduled' ? 'Scheduled' : 'Active'

    return (
      <Link href={`/assembly/bills/${bill.slug}`} className={styles.billRow}>
        <div className={styles.billNum}>
          <strong className={styles.billNumMain}>{main}</strong>
          {session && <div className={styles.billNumSession}>{session}</div>}
          {bill.billType && <div className={styles.billNumType}>{bill.billType}</div>}
        </div>
        <div className={styles.billCenter}>
          <div className={styles.billTitle}>{bill.title}</div>
          <div className={styles.billStageLine}>
            {bill.category === 'scheduled' ? 'SCHEDULED STAGE' : 'CURRENT STAGE'} · {bill.currentStage.toUpperCase()} · {formatDate(bill.latestDate)}
          </div>
          <div className={styles.billProgress}>
            {BILL_STAGES.map((s, i) => (
              <div
                key={s}
                className={styles.billProgressSeg}
                style={{
                  background:
                    i < stageIdx ? 'var(--forest)' :
                    i === stageIdx ? 'var(--teal)' :
                    'transparent',
                }}
              />
            ))}
          </div>
          <div className={styles.billProgressLabels}>
            <span>INTRO</span>
            <span>ROYAL ASSENT</span>
          </div>
        </div>
        <div className={styles.billRight}>
          <span className={`pill ${pillClass}`}>{pillLabel}</span>
          {becameLaw
            ? <div className={styles.billPct}>{formatDate(bill.royalAssentDate!)}</div>
            : <div className={styles.billPct}>{progress}% complete</div>
          }
        </div>
      </Link>
    )
  }

  return (
    <>
      {/* This week section */}
      {thisWeekBills.length > 0 && (
        <>
        <div className={styles.weekSection}>
          <div className="section-head">
            <h2>Progressed this week</h2>
          </div>
          <p className={styles.weekSubtitle}>
            Legislative stages heard in the Assembly in the week commencing <strong>{mondayLabel}</strong>.
          </p>
          <div className={styles.thisWeekList}>
            {thisWeekBills.map(bill => {
              const slug = bill.bill_id.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
              const passed = bill.has_division && isPassed(bill.outcome) === true
              return (
                <Link key={bill.bill_id} href={`/assembly/bills/${slug}`} className={styles.thisWeekRow}>
                  <div className={styles.thisWeekRowLeft}>
                    <span className={styles.thisWeekBillName}>{bill.short_title}</span>
                    <div className={styles.thisWeekPills}>
                      <span className="pill neutral">{bill.stage}</span>
                      {passed && <span className="pill pass">Passed</span>}
                    </div>
                  </div>
                  <span className={styles.thisWeekDate}>{formatDate(bill.plenary_date)}</span>
                </Link>
              )
            })}
          </div>
        </div>
        <hr className="section-rule" />
        </>
      )}

      {/* Section title */}
      <div className="section-head">
        <h2>Bills before the Assembly</h2>
      </div>

      {/* Progress key */}
      <div className={styles.progressKey}>
        <h3 className={styles.progressKeyHeading}>Reading the <em>stage bar</em></h3>
        <p className={styles.progressKeyDesc}>Each bill card shows a progress bar across the eight stages from Introduction to Royal Assent. The bar reflects where a bill currently stands in its parliamentary journey.</p>
        <div className={styles.progressKeyLegend}>
          <span className={styles.progressKeyItem}><i className={styles.progressKeyDot} style={{ background: 'var(--forest)' }} />Stage passed</span>
          <span className={styles.progressKeyItem}><i className={styles.progressKeyDot} style={{ background: 'var(--teal)' }} />Current stage</span>
          <span className={styles.progressKeyItem}><i className={styles.progressKeyDot} style={{ background: 'var(--paper-3)', border: '1px solid var(--rule)' }} />Not yet reached</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.billTabs} role="tablist" aria-label="Bill sections">
        {tabs.map(tab => {
          const count = tab === 'scheduled' ? scheduled.length : tab === 'in-progress' ? inProgress.length : completed.length
          const label = tab === 'scheduled' ? 'Scheduled' : tab === 'in-progress' ? 'In progress' : 'Completed'
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab && !isSearching}
              aria-controls={`tabpanel-${tab}`}
              id={`tab-${tab}`}
              className={`${styles.billTabBtn} ${activeTab === tab && !isSearching ? styles.billTabBtnActive : ''}`}
              onClick={() => handleTabChange(tab)}
            >
              {label}
              <span className={styles.billTabN}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Year filter (completed tab only) */}
      {activeTab === 'completed' && !isSearching && (
        <div className={styles.yearFilter}>
          {years.map(y => (
            <button
              key={y}
              className={`${styles.yearBtn} ${yearFilter === y ? styles.yearBtnActive : ''}`}
              onClick={() => { setYearFilter(y); setVisibleCount(20) }}
              aria-pressed={yearFilter === y}
            >
              {y === 'ALL' ? 'All years' : y}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className={styles.searchWrap}>
        <label htmlFor="bill-search" className="sr-only">Search bills</label>
        <input
          id="bill-search"
          type="search"
          className={styles.search}
          placeholder="Search bills…"
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {/* Result count when searching */}
      {isSearching && (
        <p className={styles.resultCount}>
          {filteredScheduled.length + filteredInProgress.length + filteredCompleted.length} bill{filteredScheduled.length + filteredInProgress.length + filteredCompleted.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Scheduled */}
      {showScheduled && (
        <section id="tabpanel-scheduled" role="tabpanel" aria-labelledby="tab-scheduled">
          {isSearching && <h2 className={styles.sectionTitle}>Scheduled for debate</h2>}
          <div className={styles.billList}>
            {filteredScheduled.length === 0
              ? <p className={styles.emptyState}>No bills match your search.</p>
              : filteredScheduled.map(bill => <BillRow key={bill.slug} bill={bill} />)
            }
          </div>
        </section>
      )}

      {/* In progress */}
      {showInProgress && (
        <section id="tabpanel-in-progress" role="tabpanel" aria-labelledby="tab-in-progress" style={isSearching && showScheduled ? { marginTop: 'var(--s-8)' } : undefined}>
          {isSearching && <h2 className={styles.sectionTitle}>In progress</h2>}
          <div className={styles.billList}>
            {filteredInProgress.length === 0
              ? <p className={styles.emptyState}>No bills match your search.</p>
              : filteredInProgress.map(bill => <BillRow key={bill.slug} bill={bill} />)
            }
          </div>
        </section>
      )}

      {/* Completed */}
      {showCompleted && (
        <section id="tabpanel-completed" role="tabpanel" aria-labelledby="tab-completed" style={isSearching && (showScheduled || showInProgress) ? { marginTop: 'var(--s-8)' } : undefined}>
          {isSearching && <h2 className={styles.sectionTitle}>Completed</h2>}
          <div className={styles.billList}>
            {visibleCompleted.length === 0
              ? <p className={styles.emptyState}>No bills match your search.</p>
              : visibleCompleted.map(bill => <BillRow key={bill.slug} bill={bill} />)
            }
          </div>
          {hasMore && !isSearching && (
            <button className={styles.loadMore} onClick={() => setVisibleCount(c => c + 20)}>
              Load more ({filteredCompleted.length - visibleCount} remaining)
            </button>
          )}
        </section>
      )}
    </>
  )
}
