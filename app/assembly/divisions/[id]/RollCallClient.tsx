'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { formatMemberName, getSurname, abbreviateParty } from '@/lib/format'
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
  members,
  showVoteLabel = false,
}: {
  heading: string
  members: Vote[]
  showVoteLabel?: boolean
}) {
  const { basePath } = useMandate()
  const sorted = [...members].sort((a, b) =>
    getSurname(a.fullName).localeCompare(getSurname(b.fullName))
  )
  const groups = groupByParty(sorted)
  return (
    <div>
      <h3 className={divStyles.columnHeading}>{heading}</h3>
      {groups.map(({ party, items }) => (
        <div key={party} className={divStyles.partyGroup}>
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

  const filteredVotes = filter === 'ALL'
    ? sortedVotes
    : sortedVotes.filter((v) => v.vote === filter)

  const ayes = sortedVotes.filter((v) => v.vote === 'AYE')
  const noes = sortedVotes.filter((v) => v.vote === 'NO')
  const abstains = sortedVotes.filter((v) => v.vote === 'ABSTAINED')
  const noShows = sortedVotes.filter((v) => v.vote === 'NO_SHOW')

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
      <h2 id="roll-call-heading" className={divStyles.rollCallHeading}>Roll call</h2>

      {/* Mobile filters */}
      <div className={styles.rollCallFilters}>
        {(['ALL', 'AYE', 'NO', 'NO_SHOW', 'ABSTAINED'] as const).map((f) => {
          const count = f === 'ALL' ? sortedVotes.length : sortedVotes.filter((v) => v.vote === f).length
          if (f !== 'ALL' && count === 0) return null
          return (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              data-filter={f}
            >
              {f === 'ALL' ? 'All' : f === 'NO_SHOW' ? 'No Show' : f.charAt(0) + f.slice(1).toLowerCase()}
              <span className={styles.filterCount}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Mobile grouped list */}
      <div className={styles.rollCallMobileList}>
        {groupByParty(filteredVotes).map(({ party, items }, i) => (
          <React.Fragment key={party}>
            {i > 0 && <hr className={styles.mobilePartyRule} />}
          <div className={styles.mobilePartyGroup}>
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
        ))}
      </div>

      {/* Desktop four-column layout */}
      <div className={`${divStyles.rollCall} ${styles.rollCall}`}>
        <RollColumn heading="Ayes" members={ayes} />
        <RollColumn heading="Noes" members={noes} />
        <RollColumn heading="No Show" members={noShows} />
        <RollColumn heading="Abstain" members={abstains} />
      </div>
    </section>
  )
}
