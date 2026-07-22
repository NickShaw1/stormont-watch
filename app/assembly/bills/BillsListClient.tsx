'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/format'
import { computeBillProgress, BILL_STAGES } from '@/lib/bills/billProgress'
import type { BillItem } from './BillsPageBody'
import type { BillProgressedThisWeek } from '@/lib/bills/progressedThisWeekProgress'
import BillProgressedRow from '@/components/bills/BillProgressedRow'
import { useMandate } from '@/components/MandateContext'
import styles from './bills.module.css'

interface Props {
  scheduled: BillItem[]
  inProgress: BillItem[]
  completed: BillItem[]
  progressedThisWeek: BillProgressedThisWeek[]
}

const tabs = ['scheduled', 'in-progress', 'completed'] as const
type Tab = typeof tabs[number]

function formatBillNum(billId: string): { main: string; session: string } {
  const idx = billId.lastIndexOf('/')
  if (idx === -1) return { main: billId, session: '' }
  return { main: billId.slice(0, idx), session: billId.slice(idx + 1) }
}

export default function BillsListClient({ scheduled, inProgress, completed, progressedThisWeek }: Props) {
  const { basePath } = useMandate()
  const [activeTab, setActiveTab] = useState<Tab>('scheduled')
  const [previousTab, setPreviousTab] = useState<Tab>('scheduled')
  const [isSearching, setIsSearching] = useState(false)
  const [yearFilter, setYearFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

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

  const visibleCompleted = filteredCompleted

  const allEmpty = isSearching && filteredScheduled.length === 0 && filteredInProgress.length === 0 && filteredCompleted.length === 0

  const showScheduled = isSearching ? filteredScheduled.length > 0 || allEmpty : activeTab === 'scheduled'
  const showInProgress = isSearching ? filteredInProgress.length > 0 || allEmpty : activeTab === 'in-progress'
  const showCompleted = isSearching ? filteredCompleted.length > 0 || allEmpty : activeTab === 'completed'

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    if (!isSearching) setPreviousTab(tab)
  }

  const handleSearch = (value: string) => {
    setSearchQuery(value)
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
    const billPassed = bill.passed === true
    const { stageIdx, scheduledIdx, percent: progress } = computeBillProgress(bill.stageHistory, bill.royalAssentDate, billPassed)

    const pillClass =
      bill.category !== 'completed'
        ? bill.category === 'scheduled' ? 'accent' : 'neutral'
        : bill.royalAssentDate ? 'pass'
        : bill.passed === false ? 'fail'
        : 'warn'

    const pillLabel =
      bill.category !== 'completed'
        ? bill.category === 'scheduled' ? 'Scheduled' : 'Active'
        : bill.royalAssentDate ? 'Became law'
        : bill.passed === false ? 'Failed'
        : 'Awaiting Royal Assent'

    return (
      <Link href={`${basePath}/assembly/bills/${bill.slug}`} className={styles.billRow}>
        <div className={styles.billNum}>
          <strong className={styles.billNumMain}>{main}</strong>
          {session && <div className={styles.billNumSession}>{session}</div>}
          {bill.billType && <div className={styles.billNumType}>{bill.billType}</div>}
        </div>
        <div className={styles.billCenter}>
          <div className={styles.billTitle}>{bill.title}</div>
          <div className={styles.billStageLine}>
            {bill.category === 'scheduled'
              ? `Scheduled stage · ${bill.currentStage} · ${formatDate(bill.latestDate)}`
              : bill.category === 'in-progress'
              ? `Current stage · ${bill.currentStage} · ${formatDate(bill.latestDate)}`
              : bill.royalAssentDate
              ? `Became law · ${formatDate(bill.royalAssentDate)}`
              : bill.passed === false
              ? 'Failed'
              : 'Awaiting Royal Assent'}
          </div>
          <div className={styles.billProgress}>
            {BILL_STAGES.map((s, i) => {
              const completedUpTo = scheduledIdx !== null ? scheduledIdx - 1 : stageIdx
              return (
                <div
                  key={s}
                  className={styles.billProgressSeg}
                  style={{
                    background:
                      i <= completedUpTo ? 'var(--forest)' :
                      i === scheduledIdx ? 'var(--teal)' :
                      'transparent',
                  }}
                />
              )
            })}
          </div>
          <div className={styles.billProgressLabels}>
            <span>INTRO</span>
            <span>ROYAL ASSENT</span>
          </div>
        </div>
        <div className={styles.billRight}>
          <div className={styles.billPills}>
            {bill.isAccelerated && (
              <span className="pill accent">Accelerated</span>
            )}
            <span className={`pill ${pillClass}`}>{pillLabel}</span>
          </div>
          {bill.category === 'completed' && bill.passed === true && bill.royalAssentDate
            ? null
            : <div className={styles.billPct}>{progress}% complete</div>
          }
        </div>
      </Link>
    )
  }

  return (
    <>
      {/* This week section */}
      {/* Progress key — always visible */}
      <div className={styles.progressKey}>
        <h3 className={styles.progressKeyHeading}>Reading the <em>stage bar</em></h3>
        <p className={styles.progressKeyDesc}>Each bill card shows a progress bar across the eight stages from Introduction to Royal Assent. The bar reflects where a bill currently stands in its parliamentary journey.</p>
        <div className={styles.progressKeyLegend}>
          <span className={styles.progressKeyItem}><i className={styles.progressKeyDot} style={{ background: 'var(--forest)' }} />Stage passed</span>
          <span className={styles.progressKeyItem}><i className={styles.progressKeyDot} style={{ background: 'var(--teal)' }} />Stage scheduled</span>
          <span className={styles.progressKeyItem}><i className={styles.progressKeyDot} style={{ background: 'var(--paper-3)', border: '1px solid var(--rule)' }} />Not yet reached</span>
        </div>
      </div>

      {progressedThisWeek.length > 0 && (
        <>
        <hr className="section-rule" />
        <div className={styles.weekSection}>
          <div className="section-head">
            <h2>Progressed this week</h2>
          </div>
          <p className={styles.weekSubtitle}>
            Legislative stages heard in the Assembly in the week commencing <strong>{mondayLabel}</strong>.
          </p>
          <div className={styles.billList}>
            {progressedThisWeek.map(bill => <BillProgressedRow key={bill.billId} bill={bill} />)}
          </div>
        </div>
        </>
      )}

      {/* Section title */}
      <hr className="section-rule" />
      <div className="section-head">
        <h2>Bills before the Assembly</h2>
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
              onClick={() => { setYearFilter(y) }}
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
          <strong>{filteredScheduled.length + filteredInProgress.length + filteredCompleted.length}</strong> bill{filteredScheduled.length + filteredInProgress.length + filteredCompleted.length !== 1 ? 's' : ''} found
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
        </section>
      )}
    </>
  )
}
