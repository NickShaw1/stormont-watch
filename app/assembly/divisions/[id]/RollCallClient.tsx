'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ClipboardList, CheckCircle2, XCircle, UserX, MinusCircle } from 'lucide-react'
import type { ComponentType } from 'react'
import { formatMemberName, getSurname, abbreviateParty, partyBorderColor } from '@/lib/format'
import PartyName from '@/components/PartyName'
import { useMandate } from '@/components/MandateContext'
import divStyles from './divisionDetail.module.css'
import styles from './rollCall.module.css'


type Vote = {
  personId: string
  fullName: string
  party?: string | null
  vote: string
  designation?: string | null
}

type FilterValue = 'ALL' | 'AYE' | 'NO' | 'ABSTAINED' | 'NO_SHOW'

// Same open/close + outside-click + focus-on-open + arrow-key nav behavior as the
// votes list page's mobile dropdowns (mirrors VotesListClient.tsx's useDropdown).
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

const FILTER_LABELS: Record<FilterValue, string> = {
  ALL: 'All votes',
  AYE: 'Ayes',
  NO: 'Noes',
  NO_SHOW: 'No Show',
  ABSTAINED: 'Abstain',
}

function groupByParty(members: Vote[]): { party: string; items: Vote[] }[] {
  const map = new Map<string, Vote[]>()
  for (const m of members) {
    const key = m.party ?? 'Independent'
    const group = map.get(key) ?? []
    group.push(m)
    map.set(key, group)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([party, items]) => ({
      party,
      items: [...items].sort((a, b) =>
        getSurname(a.fullName).localeCompare(getSurname(b.fullName))
      ),
    }))
}

function RollColumn({
  heading,
  icon: Icon,
  colorClass,
  members,
  showVoteLabel = false,
}: {
  heading: string
  icon: ComponentType<{ className?: string; size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>
  colorClass?: string
  members: Vote[]
  showVoteLabel?: boolean
}) {
  const { basePath } = useMandate()
  const sorted = [...members].sort((a, b) =>
    getSurname(a.fullName).localeCompare(getSurname(b.fullName))
  )
  const groups = groupByParty(sorted)
  return (
    <div className={divStyles.rollCallCol}>
      <h3 className={`${divStyles.columnHeading} ${colorClass ?? ''}`}>
        <Icon className={divStyles.columnHeadingIcon} size={18} strokeWidth={1.75} aria-hidden={true} />
        {heading}
      </h3>
      {groups.map(({ party, items }) => (
        <div
          key={party}
          className={divStyles.partyGroup}
          style={{ borderTopColor: partyBorderColor(party) }}
        >
          <div className={divStyles.partyGroupHeading}>
            <span className="party-pill" data-party={abbreviateParty(party)}>
              <PartyName party={party} />
            </span>
          </div>
          <ul className={divStyles.nameList} role="list">
            {items.map((v) => (
              <li key={`${v.personId}-${v.vote}`} className={divStyles.nameItem}>
                <Link href={`${basePath}/assembly/mlas/${v.personId}`}>{formatMemberName(v.fullName)}</Link>
                {showVoteLabel && (
                  <span className={`vote-pill ${v.vote === 'NO_SHOW' ? 'vote-noshow' : 'vote-abstain'}`}>
                    {v.vote === 'NO_SHOW' ? 'No Show' : 'Abstain'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default function RollCallClient({ votes }: { votes: Vote[] }) {
  const { basePath } = useMandate()
  const sortedVotes = [...votes].sort((a, b) =>
    getSurname(a.fullName).localeCompare(getSurname(b.fullName))
  )

  const [filter, setFilter] = useState<FilterValue>('ALL')
  const filterDropdown = useDropdown()

  const filteredVotes = filter === 'ALL'
    ? sortedVotes
    : sortedVotes.filter((v) => v.vote === filter)

  const ayes = sortedVotes.filter((v) => v.vote === 'AYE')
  const noes = sortedVotes.filter((v) => v.vote === 'NO')
  const abstains = sortedVotes.filter((v) => v.vote === 'ABSTAINED')
  const noShows = sortedVotes.filter((v) => v.vote === 'NO_SHOW')

  const voteTypeGroups: { key: FilterValue; label: string; icon: typeof CheckCircle2; colorClass?: string; items: Vote[] }[] = [
    { key: 'AYE' as const, label: 'Ayes', icon: CheckCircle2, colorClass: divStyles.columnHeadingAye, items: ayes },
    { key: 'NO' as const, label: 'Noes', icon: XCircle, colorClass: divStyles.columnHeadingNo, items: noes },
    { key: 'NO_SHOW' as const, label: 'No Show', icon: UserX, items: noShows },
    { key: 'ABSTAINED' as const, label: 'Abstain', icon: MinusCircle, items: abstains },
  ].filter((g) => g.items.length > 0)

  const voteLabel = (v: Vote) => {
    if (v.vote === 'NO_SHOW') return 'No Show'
    if (v.vote === 'AYE') return 'Aye'
    if (v.vote === 'NO') return 'No'
    if (v.vote === 'ABSTAINED') return 'Abstain'
    return v.vote
  }

  const votePillClass = (vote: string) => {
    if (vote === 'AYE') return styles.voteAYE
    if (vote === 'NO') return styles.voteNO
    if (vote === 'NO_SHOW') return styles.voteNO_SHOW
    if (vote === 'ABSTAINED') return styles.voteABSTAINED
    return ''
  }

  return (
    <section aria-labelledby="roll-call-heading">
      <div className={divStyles.sectionHead}>
        <span className={divStyles.eyebrow}>The vote</span>
        <h2 id="roll-call-heading" className={divStyles.sectionHeading}>
          <ClipboardList className={divStyles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
          Roll call
        </h2>
      </div>

      {/* Mobile filter dropdown — same trigger/list shape as the votes list page's
          mobile dropdowns, replacing the old 2x2 filter button grid. */}
      <div className={styles.rollCallFilterDropdown}>
        <div className={styles.dropdownWrap} ref={filterDropdown.wrapRef}>
          <button
            ref={filterDropdown.triggerRef}
            type="button"
            className={styles.dropdownTrigger}
            onClick={() => filterDropdown.setOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={filterDropdown.open}
          >
            {FILTER_LABELS[filter]}
            <svg
              className={`${styles.dropdownTriggerChevron} ${filterDropdown.open ? styles.dropdownTriggerChevronOpen : ''}`}
              width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
            >
              <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          {filterDropdown.open && (
            <ul ref={filterDropdown.listRef} className={styles.dropdownList} role="listbox">
              {(['ALL', 'AYE', 'NO', 'NO_SHOW', 'ABSTAINED'] as const).map((f) => {
                const count = f === 'ALL' ? sortedVotes.length : sortedVotes.filter((v) => v.vote === f).length
                if (f !== 'ALL' && count === 0) return null
                const select = () => { setFilter(f); filterDropdown.setOpen(false) }
                return (
                  <li
                    key={f}
                    role="option"
                    tabIndex={0}
                    aria-selected={filter === f}
                    className={`${styles.dropdownItem} ${filter === f ? styles.dropdownItemSelected : ''}`}
                    onClick={select}
                    onKeyDown={(e) => filterDropdown.handleKeyDown(e, select)}
                  >
                    {FILTER_LABELS[f]}
                    <span className={styles.filterCount}>{count}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Mobile grouped list — grouped by vote type first (with a colour-coded heading,
          matching the desktop columns) when showing everything, since "ALL" otherwise
          has no way to tell Ayes from Noes apart except the per-row vote pill. */}
      <div className={styles.rollCallMobileList}>
        {filter === 'ALL' ? (
          voteTypeGroups.map(({ key, label, icon: Icon, colorClass, items: typeItems }) => (
            <div key={key} className={styles.mobileVoteTypeGroup}>
              <h3 className={`${divStyles.columnHeading} ${styles.mobileVoteTypeHeading} ${colorClass ?? ''}`}>
                <Icon className={divStyles.columnHeadingIcon} size={18} strokeWidth={1.75} aria-hidden={true} />
                {label}
              </h3>
              {groupByParty(typeItems).map(({ party, items }, i) => (
                <React.Fragment key={party}>
                  {i > 0 && <hr className={styles.mobilePartyRule} />}
                  <div className={styles.mobilePartyGroup} style={{ borderTopColor: partyBorderColor(party) }}>
                    <div className={styles.mobilePartyHeading}>
                      <span className="party-pill" data-party={abbreviateParty(party)}>
                        <PartyName party={party} />
                      </span>
                    </div>
                    {items.map((v) => (
                      <div key={`${v.personId}-${v.vote}`} className={styles.rollCallMobileRow}>
                        <Link href={`${basePath}/assembly/mlas/${v.personId}`} className={styles.rollCallName}>
                          {formatMemberName(v.fullName)}
                        </Link>
                      </div>
                    ))}
                  </div>
                </React.Fragment>
              ))}
            </div>
          ))
        ) : (
        groupByParty(filteredVotes).map(({ party, items }, i) => (
          <React.Fragment key={party}>
            {i > 0 && <hr className={styles.mobilePartyRule} />}
          <div className={styles.mobilePartyGroup} style={{ borderTopColor: partyBorderColor(party) }}>
            <div className={styles.mobilePartyHeading}>
              <span className="party-pill" data-party={abbreviateParty(party)}>
                <PartyName party={party} />
              </span>
            </div>
            {items.map((v) => (
              <div key={`${v.personId}-${v.vote}`} className={styles.rollCallMobileRow}>
                <Link href={`${basePath}/assembly/mlas/${v.personId}`} className={styles.rollCallName}>
                  {formatMemberName(v.fullName)}
                </Link>
                <span className={`${styles.votePill} ${votePillClass(v.vote)}`}>
                  {voteLabel(v)}
                </span>
              </div>
            ))}
          </div>
          </React.Fragment>
        ))
        )}
      </div>

      {/* Desktop four-column layout */}
      <div className={divStyles.rollCallCard}>
        <div className={`${divStyles.rollCall} ${styles.rollCall}`}>
          <RollColumn heading="Ayes" icon={CheckCircle2} colorClass={divStyles.columnHeadingAye} members={ayes} />
          <RollColumn heading="Noes" icon={XCircle} colorClass={divStyles.columnHeadingNo} members={noes} />
          <RollColumn heading="No Show" icon={UserX} members={noShows} />
          <RollColumn heading="Abstain" icon={MinusCircle} members={abstains} />
        </div>
      </div>
    </section>
  )
}
