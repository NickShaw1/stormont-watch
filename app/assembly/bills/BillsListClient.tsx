'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { SearchX, CalendarX, Scale, CheckCircle2, TrendingUp, Landmark, ExternalLink, Zap, Crown } from 'lucide-react'
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

const TAB_LABELS: Record<Tab, string> = {
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  completed: 'Completed',
}

// BILL_STAGES minus "Introduction" — that's not a numbered stage.
const NUMBERED_STAGES = BILL_STAGES.slice(1).map(s => s.replace(/ Stage$/, ''))

function formatBillNum(billId: string): { main: string; session: string } {
  const idx = billId.lastIndexOf('/')
  if (idx === -1) return { main: billId, session: '' }
  return { main: billId.slice(0, idx), session: billId.slice(idx + 1) }
}

// Same open/close + outside-click + focus-on-open + arrow-key nav behavior as the
// homepage constituency selector's trigger/list (mirrors MlasListClient.tsx's hook).
function useDropdown() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return
    const list = listRef.current
    if (list) {
      const sel = list.querySelector<HTMLLIElement>('[aria-selected="true"]') ?? list.querySelector<HTMLLIElement>('li')
      sel?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent<HTMLLIElement>, onSelect: () => void) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    } else if (e.key === 'Escape') {
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const items = Array.from(listRef.current?.querySelectorAll<HTMLLIElement>('li') ?? [])
      items[items.indexOf(e.currentTarget) + 1]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const items = Array.from(listRef.current?.querySelectorAll<HTMLLIElement>('li') ?? [])
      items[items.indexOf(e.currentTarget) - 1]?.focus()
    }
  }

  return { open, setOpen, wrapRef, triggerRef, listRef, handleKeyDown }
}

export default function BillsListClient({ scheduled, inProgress, completed, progressedThisWeek }: Props) {
  const { basePath } = useMandate()
  // No scheduled bills → drop that tab, default to "In progress".
  const visibleTabs = scheduled.length === 0 ? tabs.filter(t => t !== 'scheduled') : tabs
  const defaultTab: Tab = scheduled.length === 0 ? 'in-progress' : 'scheduled'
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab)
  const [previousTab, setPreviousTab] = useState<Tab>(defaultTab)
  const [isSearching, setIsSearching] = useState(false)
  const [yearFilter, setYearFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const tabDropdown = useDropdown()
  const yearDropdown = useDropdown()

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

  const showScheduled = isSearching ? filteredScheduled.length > 0 : activeTab === 'scheduled'
  const showInProgress = isSearching ? filteredInProgress.length > 0 : activeTab === 'in-progress'
  const showCompleted = isSearching ? filteredCompleted.length > 0 : activeTab === 'completed'

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

  const EmptyState = ({ icon: Icon, children }: { icon: typeof SearchX; children: React.ReactNode }) => (
    <p className={styles.emptyState}>
      <Icon className={styles.emptyStateIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
      {children}
    </p>
  )

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

    const statusBadgeClass =
      bill.category !== 'completed'
        ? bill.category === 'scheduled' ? styles.statusBadgeScheduled : styles.statusBadgeActive
        : bill.royalAssentDate ? styles.statusBadgeBecameLaw
        : bill.passed === false ? styles.statusBadgeError
        : styles.statusBadgeWarn

    const statusLabel =
      bill.category !== 'completed'
        ? bill.category === 'scheduled' ? 'Scheduled' : 'Active'
        : bill.royalAssentDate ? 'Became law'
        : bill.passed === false ? 'Failed'
        : 'Awaiting Royal Assent'

    return (
      <Link href={`${basePath}/assembly/bills/${bill.slug}`} className={styles.billRow}>
        <div className={styles.billNum}>
          <span className={styles.billNumMain}>{main}</span>
          {session && <span className={styles.billNumSession}>{session}</span>}
          {bill.billType && <span className={styles.billNumType}>{bill.billType}</span>}
        </div>
        <div className={styles.billCenter}>
          <div className={styles.billTitleRow}>
            <div className={styles.billTitle}>{bill.title}</div>
            <div className={styles.billBadgeRow}>
              {bill.isAccelerated && (
                <span className={`${styles.statusBadge} ${styles.statusBadgeFlag}`}>
                  <Zap size={11} strokeWidth={2} aria-hidden="true" />
                  Accelerated
                </span>
              )}
              <span className={`${styles.statusBadge} ${statusBadgeClass}`}>
                {bill.royalAssentDate && <CheckCircle2 size={11} strokeWidth={2} aria-hidden="true" />}
                {bill.category === 'completed' && !bill.royalAssentDate && bill.passed !== false && (
                  <Crown size={11} strokeWidth={2} aria-hidden="true" />
                )}
                {statusLabel}
              </span>
              {bill.legislationUrl && (
                <span
                  role="link"
                  tabIndex={0}
                  className={styles.statusBadgeLink}
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    window.open(bill.legislationUrl!, '_blank', 'noopener,noreferrer')
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      window.open(bill.legislationUrl!, '_blank', 'noopener,noreferrer')
                    }
                  }}
                >
                  View Act
                  <ExternalLink size={11} strokeWidth={2} aria-hidden="true" />
                </span>
              )}
            </div>
          </div>
          {(() => {
            // Completed bills without a extra date (Failed/Awaiting Royal Assent) would
            // just repeat the badge text above with nothing new, so the line is dropped.
            const stagePart =
              bill.category === 'scheduled' ? `Scheduled stage · ${bill.currentStage}`
              : bill.category === 'in-progress' ? `Current stage · ${bill.currentStage}`
              : null
            const datePart =
              bill.category === 'scheduled' || bill.category === 'in-progress'
                ? formatDate(bill.latestDate)
                : bill.royalAssentDate
                ? formatDate(bill.royalAssentDate)
                : null
            if (!stagePart && !datePart) return null
            return (
              <div className={styles.billStageLine}>
                {stagePart && <span className={styles.billStageLinePart}>{stagePart}</span>}
                {stagePart && datePart && <span className={styles.billStageLineSep}> · </span>}
                {datePart && <span className={styles.billStageLineDate}>{datePart}</span>}
              </div>
            )
          })()}
          <div className={styles.billProgressWrap}>
            <div className={styles.billProgressLabels}>
              <span className={styles.billProgressStageCount}>Stage {Math.max(stageIdx, 0)} of {BILL_STAGES.length - 1}</span>
              <span className={styles.billProgressPct}>{progress}%</span>
            </div>
            <div className={styles.billProgress}>
              {NUMBERED_STAGES.map((s, j) => {
                const i = j + 1 // offset for the dropped "Introduction" index
                const completedUpTo = scheduledIdx !== null ? scheduledIdx - 1 : stageIdx
                const state = i <= completedUpTo ? 'done' : i === scheduledIdx ? 'scheduled' : undefined
                return <div key={s} className={styles.billProgressSeg} data-state={state} title={s} />
              })}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <>
      {progressedThisWeek.length > 0 && (
        <div>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>This week</span>
            <h2 className={styles.sectionTitle}>
              <TrendingUp className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              Progressed this week
            </h2>
            <p className={styles.sectionSubtitle}>
              Legislative stages heard in the Assembly in the week commencing <strong>{mondayLabel}</strong>.
            </p>
          </div>
          <div className={styles.billList}>
            {progressedThisWeek.map(bill => <BillProgressedRow key={bill.billId} bill={bill} />)}
          </div>
        </div>
      )}

      <div className={styles.sectionHead}>
        <span className={styles.sectionEyebrow}>All legislation</span>
        <h2 className={styles.sectionTitle}>
          <Landmark className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
          Bills before the Assembly
        </h2>
      </div>

      <div className={styles.progressKey}>
        <div className={styles.progressKeyRow}>
          <span className={styles.progressKeyLabel}>Reading the stage bar:</span>
          <span className={styles.progressKeyItem}><i className={styles.progressKeyDot} style={{ background: 'var(--sw-success)' }} />Passed</span>
          <span className={styles.progressKeyItem}><i className={styles.progressKeyDot} style={{ background: 'var(--sw-accent-warm)' }} />Scheduled</span>
          <span className={styles.progressKeyItem}><i className={styles.progressKeyDot} style={{ background: 'var(--sw-surface-subtle)', border: '1px solid var(--sw-border-strong)' }} />Not yet reached</span>
        </div>
        <div className={styles.progressKeyStagesRow}>
          <span className={styles.progressKeyLabel}>Stages:</span>
          <span className={styles.progressKeyStages}>
            {NUMBERED_STAGES.map((s, i) => (
              <span key={s} className={styles.progressKeyStageItem}>
                <span className={styles.progressKeyStageNum}>{i + 1}</span>
                {s}
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className={styles.filterPanel}>
        <div className={styles.billTabs} role="tablist" aria-label="Bill sections">
          {visibleTabs.map(tab => {
            const count = tab === 'scheduled' ? scheduled.length : tab === 'in-progress' ? inProgress.length : completed.length
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
                {TAB_LABELS[tab]}
                <span className={styles.billTabN}>{count}</span>
              </button>
            )
          })}
        </div>

        <div className={styles.tabDropdownWrap}>
          <div className={styles.dropdownWrap} ref={tabDropdown.wrapRef}>
            <button
              ref={tabDropdown.triggerRef}
              type="button"
              className={styles.dropdownTrigger}
              onClick={() => tabDropdown.setOpen(o => !o)}
              aria-haspopup="listbox"
              aria-expanded={tabDropdown.open}
            >
              {TAB_LABELS[activeTab]}
              <svg
                className={`${styles.dropdownTriggerChevron} ${tabDropdown.open ? styles.dropdownTriggerChevronOpen : ''}`}
                width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
              >
                <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {tabDropdown.open && (
              <ul ref={tabDropdown.listRef} className={styles.dropdownList} role="listbox">
                {visibleTabs.map(tab => {
                  const count = tab === 'scheduled' ? scheduled.length : tab === 'in-progress' ? inProgress.length : completed.length
                  const select = () => { handleTabChange(tab); tabDropdown.setOpen(false) }
                  return (
                    <li
                      key={tab}
                      role="option"
                      tabIndex={0}
                      aria-selected={activeTab === tab}
                      className={`${styles.dropdownItem} ${activeTab === tab ? styles.dropdownItemSelected : ''}`}
                      onClick={select}
                      onKeyDown={e => tabDropdown.handleKeyDown(e, select)}
                    >
                      {TAB_LABELS[tab]}
                      <span className={styles.dropdownItemCount}>{count}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {activeTab === 'completed' && !isSearching && (
          <>
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

            <div className={styles.yearDropdownWrap}>
              <div className={styles.dropdownWrap} ref={yearDropdown.wrapRef}>
                <button
                  ref={yearDropdown.triggerRef}
                  type="button"
                  className={styles.dropdownTrigger}
                  onClick={() => yearDropdown.setOpen(o => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={yearDropdown.open}
                >
                  {yearFilter === 'ALL' ? 'All years' : yearFilter}
                  <svg
                    className={`${styles.dropdownTriggerChevron} ${yearDropdown.open ? styles.dropdownTriggerChevronOpen : ''}`}
                    width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
                  >
                    <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>

                {yearDropdown.open && (
                  <ul ref={yearDropdown.listRef} className={styles.dropdownList} role="listbox">
                    {years.map(y => {
                      const select = () => { setYearFilter(y); yearDropdown.setOpen(false) }
                      return (
                        <li
                          key={y}
                          role="option"
                          tabIndex={0}
                          aria-selected={yearFilter === y}
                          className={`${styles.dropdownItem} ${yearFilter === y ? styles.dropdownItemSelected : ''}`}
                          onClick={select}
                          onKeyDown={e => yearDropdown.handleKeyDown(e, select)}
                        >
                          {y === 'ALL' ? 'All years' : y}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}

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
      </div>

      {isSearching && !allEmpty && (
        <p className={styles.resultCount}>
          <strong>{filteredScheduled.length + filteredInProgress.length + filteredCompleted.length}</strong> bill{filteredScheduled.length + filteredInProgress.length + filteredCompleted.length !== 1 ? 's' : ''} found
        </p>
      )}

      {allEmpty && (
        <div className={styles.billList}>
          <EmptyState icon={SearchX}>No bills match your search.</EmptyState>
        </div>
      )}

      {/* Scheduled */}
      {showScheduled && (
        <section id="tabpanel-scheduled" role="tabpanel" aria-labelledby="tab-scheduled">
          {isSearching && <h3 className={styles.searchGroupTitle}>Scheduled for debate</h3>}
          <div className={styles.billList}>
            {filteredScheduled.length === 0
              ? <EmptyState icon={CalendarX}>Nothing scheduled at the moment.</EmptyState>
              : filteredScheduled.map(bill => <BillRow key={bill.slug} bill={bill} />)
            }
          </div>
        </section>
      )}

      {/* In progress */}
      {showInProgress && (
        <section id="tabpanel-in-progress" role="tabpanel" aria-labelledby="tab-in-progress" style={isSearching && showScheduled ? { marginTop: 'var(--s-8)' } : undefined}>
          {isSearching && <h3 className={styles.searchGroupTitle}>In progress</h3>}
          <div className={styles.billList}>
            {filteredInProgress.length === 0
              ? <EmptyState icon={Scale}>No bills currently in progress.</EmptyState>
              : filteredInProgress.map(bill => <BillRow key={bill.slug} bill={bill} />)
            }
          </div>
        </section>
      )}

      {/* Completed */}
      {showCompleted && (
        <section id="tabpanel-completed" role="tabpanel" aria-labelledby="tab-completed" style={isSearching && (showScheduled || showInProgress) ? { marginTop: 'var(--s-8)' } : undefined}>
          {isSearching && <h3 className={styles.searchGroupTitle}>Completed</h3>}
          <div className={styles.billList}>
            {visibleCompleted.length === 0
              ? <EmptyState icon={CheckCircle2}>{yearFilter === 'ALL' ? 'No completed bills yet.' : `No bills completed in ${yearFilter}.`}</EmptyState>
              : visibleCompleted.map(bill => <BillRow key={bill.slug} bill={bill} />)
            }
          </div>
        </section>
      )}
    </>
  )
}
