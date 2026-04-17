'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/format'
import type { BillItem } from './page'
import BillStagePill from '@/app/components/BillStagePill'
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

  const showSectionHeadings = isSearching

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    setVisibleCount(20)
    if (!isSearching) {
      setPreviousTab(tab)
    }
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

  const BillCard = ({ bill }: { bill: BillItem }) => (
    <React.Fragment key={bill.slug}>
      {/* Desktop card */}
      <Link href={`/assembly/bills/${bill.slug}`} className={`${styles.billCard} ${styles.desktopCard}`}>
        <div className={styles.billHeader}>
          <div className={styles.billTitle}>{bill.title}</div>
          <span className={styles.billDate}>{formatDate(bill.latestDate)}</span>
        </div>
        <div className={styles.billPills}>
          {bill.billType && <span className={styles.billTypePill}>{bill.billType}</span>}
          {bill.isAccelerated && <span className={styles.pillAccelerated}>Accelerated passage</span>}
          <BillStagePill category={bill.category} currentStage={bill.currentStage} passed={bill.passed} />
          {bill.royalAssentDate && (
            <span className={`${styles.pillBecameLaw} ${styles.pillRight}`} role="status">
              <span className={styles.pillBecameLawLabel}>Became law</span>
              <span className={styles.pillSep} aria-hidden="true" />
              <span className={styles.pillBecameLawDate}>{formatDate(bill.royalAssentDate)}</span>
            </span>
          )}
          {bill.category === 'completed' && !bill.royalAssentDate && (
            <span className={`${styles.pillAwaitingAssent} ${styles.pillRight}`} role="status">
              Awaiting Royal Assent
            </span>
          )}
          {bill.passed === false && (
            <span className={`${styles.pillFailed} ${styles.pillRight}`} role="status">Failed</span>
          )}
        </div>
      </Link>
      {/* Mobile card */}
      <Link href={`/assembly/bills/${bill.slug}`} className={styles.mobileCard}>
        <div className={styles.mobileCardTop}>
          <div className={styles.mobileCardTitle}>{bill.title}</div>
          <span className={styles.mobileCardDate}>{formatDate(bill.latestDate)}</span>
        </div>
        <div className={styles.mobileCardPills}>
          {bill.billType && <span className={styles.pillType}>{bill.billType}</span>}
          {bill.isAccelerated && <span className={styles.pillAccel}>Accelerated</span>}
          <BillStagePill category={bill.category} currentStage={bill.currentStage} passed={bill.passed} />
          {bill.royalAssentDate && (
            <span className={styles.pillLaw}>Became law · {formatDate(bill.royalAssentDate)}</span>
          )}
          {bill.category === 'completed' && !bill.royalAssentDate && (
            <span className={styles.pillAwaiting}>Awaiting Royal Assent</span>
          )}
          {bill.passed === false && (
            <span className={styles.pillFailed}>Failed</span>
          )}
        </div>
      </Link>
    </React.Fragment>
  )

  const monday = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return d
  })()

  const mondayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(monday)

  return (
    <div className="container">
      {/* This week section */}
      {thisWeekBills.length > 0 && (
        <>
          <div className={styles.weekSectionHead}>
            <h2 className={styles.weekSectionTitle}><span className={styles.weekSectionTitleText}>Progressed this week</span></h2>
            <p className={`${styles.weekSubtitle} ${styles.weekSubtitleDesktop}`}>Assembly business for the week commencing <strong style={{ color: 'var(--text-primary)' }}>{mondayLabel}</strong>.</p>
            <p className={`${styles.weekSubtitle} ${styles.weekSubtitleMobile}`}>Assembly business, w/c <strong style={{ color: 'var(--text-primary)' }}>{mondayLabel}</strong></p>
          </div>
          <div className={styles.thisWeekCard}>
            <div className={styles.thisWeekList}>
              {thisWeekBills.map(bill => {
                const slug = bill.bill_id.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
                const passed = bill.has_division && /carried/i.test(bill.outcome ?? '')
                const fullDate = formatDate(bill.plenary_date)
                const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(bill.plenary_date))
                return (
                  <React.Fragment key={bill.bill_id}>
                    {/* Desktop row */}
                    <Link href={`/assembly/bills/${slug}`} className={`${styles.thisWeekRow} ${styles.thisWeekRowDesktop}`}>
                      <div className={styles.thisWeekRowLeft}>
                        <span className={styles.thisWeekBillName}>{bill.short_title}</span>
                        <div className={styles.thisWeekPills}>
                          {bill.bill_type && <span className={styles.billTypePill}>{bill.bill_type}</span>}
                          <span className={styles.thisWeekStagePill}>{bill.stage}</span>
                          {passed && <span className={styles.thisWeekPassedPill}>Passed</span>}
                        </div>
                      </div>
                      <span className={styles.thisWeekDate}>{fullDate}</span>
                    </Link>
                    {/* Mobile row */}
                    <Link href={`/assembly/bills/${slug}`} className={`${styles.thisWeekRow} ${styles.thisWeekRowMobile}`}>
                      <div className={styles.thisWeekMobileTop}>
                        <span className={styles.thisWeekBillName}>{bill.short_title}</span>
                        <span className={styles.thisWeekDate}>{shortDate}</span>
                      </div>
                      <div className={styles.thisWeekPills}>
                        <span className={styles.thisWeekStagePill}>{bill.stage}</span>
                        {passed && <span className={styles.thisWeekPassedPill}>Passed</span>}
                      </div>
                    </Link>
                  </React.Fragment>
                )
              })}
            </div>
          </div>
          <hr className="section-rule" style={{ margin: '40px 0' }} />
        </>
      )}

      {/* Browse section heading */}
      <div className={styles.browseSectionHead}>
        <h2 className={styles.sectionTitle}>Browse legislation</h2>
        <p className={styles.browseSubtitle}>Search upcoming legislation, bills in progress, or acts and bills passed into law since May 2022.</p>
      </div>

      {/* Tab bar */}
      <div className={styles.tabList} role="tablist" aria-label="Bill sections">
        {tabs.map(tab => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`tabpanel-${tab}`}
            id={`tab-${tab}`}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''} ${activeTab === tab && tab === 'completed' ? styles.tabActiveCompleted : ''}`}
            onClick={() => handleTabChange(tab)}
          >
            {tab === 'scheduled' ? 'Scheduled' : tab === 'in-progress' ? 'In progress' : 'Completed'}
          </button>
        ))}
        {activeTab === 'completed' && (
          <div className={styles.tabYearFilters}>
            <div className={styles.filterDivider} />
            {years.map(y => (
              <button
                key={y}
                className={`${styles.filterBtn} ${yearFilter === y ? styles.filterBtnActive : ''}`}
                onClick={() => { setYearFilter(y); setVisibleCount(20) }}
                aria-pressed={yearFilter === y}
              >
                {y === 'ALL' ? 'All years' : y}
              </button>
            ))}
          </div>
        )}
      </div>

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

      {/* Scheduled section */}
      {showScheduled && (
        <section
          id="tabpanel-scheduled"
          role="tabpanel"
          aria-labelledby="tab-scheduled"
          className={styles.section}
        >
          {showSectionHeadings && <h2 className={styles.sectionTitle}>Scheduled for debate</h2>}
          {(activeTab === 'scheduled' || showSectionHeadings) && (
            <h3 className={styles.scheduledHeading}>Upcoming schedule</h3>
          )}
          <div className={styles.billList}>
            {filteredScheduled.length === 0 ? (
              <p className={styles.emptyState}>No bills match your search.</p>
            ) : (
              filteredScheduled.map(bill => <BillCard key={bill.slug} bill={bill} />)
            )}
          </div>
        </section>
      )}

      {showSectionHeadings && showScheduled && showInProgress && (
        <hr className="section-rule" />
      )}

      {/* In progress section */}
      {showInProgress && (
        <section
          id="tabpanel-in-progress"
          role="tabpanel"
          aria-labelledby="tab-in-progress"
          className={styles.section}
        >
          {showSectionHeadings && <h2 className={styles.sectionTitle}>In progress</h2>}
          {(activeTab === 'in-progress' || showSectionHeadings) && (
            <h3 className={styles.scheduledHeading}>Bills currently going through the Assembly</h3>
          )}
          <div className={styles.billList}>
            {filteredInProgress.length === 0 ? (
              <p className={styles.emptyState}>No bills match your search.</p>
            ) : (
              filteredInProgress.map(bill => <BillCard key={bill.slug} bill={bill} />)
            )}
          </div>
        </section>
      )}

      {showSectionHeadings && (showScheduled || showInProgress) && showCompleted && (
        <hr className="section-rule" />
      )}

      {/* Completed section */}
      {showCompleted && (
        <section
          id="tabpanel-completed"
          role="tabpanel"
          aria-labelledby="tab-completed"
          className={styles.section}
        >
          {showSectionHeadings && <h2 className={styles.sectionTitle}>Completed</h2>}

{!isSearching && (
            <h3 className={styles.scheduledHeading}>
              {filteredCompleted.length} bill{filteredCompleted.length !== 1 ? 's' : ''} and act{filteredCompleted.length !== 1 ? 's' : ''} passed into law or awaiting Royal Assent{yearFilter !== 'ALL' ? ` in ${yearFilter}` : ''}
            </h3>
          )}

          <div className={styles.billList}>
            {visibleCompleted.length === 0 ? (
              <p className={styles.emptyState}>No bills match your search.</p>
            ) : (
              visibleCompleted.map(bill => <BillCard key={bill.slug} bill={bill} />)
            )}
          </div>

          {hasMore && !isSearching && (
            <button
              className={styles.loadMore}
              onClick={() => setVisibleCount(c => c + 20)}
            >
              Load more ({filteredCompleted.length - visibleCount} remaining)
            </button>
          )}
        </section>
      )}
    </div>
  )
}
