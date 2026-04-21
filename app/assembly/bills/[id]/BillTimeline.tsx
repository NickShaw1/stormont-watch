'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/format'
import { isPassed } from '@/lib/bills'
import styles from './billDetail.module.css'

const STAGE_PRIORITY: Record<string, number> = {
  'royal assent': 7,
  'final stage': 6,
  'further consideration stage': 5,
  'consideration stage': 4,
  'committee stage': 3,
  'second stage': 2,
  'first stage': 1,
}

function getStagePriority(stage: string): number {
  const s = stage.toLowerCase()
  for (const [key, val] of Object.entries(STAGE_PRIORITY)) {
    if (s.includes(key)) return val
  }
  return 0
}

export interface BillStageItem {
  document_id: string
  stage: string
  plenary_date: string
  has_division: boolean
  division_id: string | null
  item_title: string | null
  outcome: string | null
  total_ayes: number | null
  total_noes: number | null
  division_type: string | null
}

export interface StageGroup {
  label: string
  date: string
  items: BillStageItem[]
}

export function groupAndSortStages(stages: BillStageItem[]): StageGroup[] {
  const groups: StageGroup[] = []
  const seen = new Map<string, StageGroup>()

  for (const stage of stages) {
    const isFurther = /further consideration stage/i.test(stage.stage)
    const isConsideration = !isFurther && /consideration stage/i.test(stage.stage)
    const key = isConsideration
      ? `consideration-${stage.plenary_date.slice(0, 10)}`
      : `${stage.stage}-${stage.plenary_date.slice(0, 10)}`

    if (seen.has(key)) {
      seen.get(key)!.items.push(stage)
    } else {
      const group: StageGroup = {
        label: isConsideration ? 'Consideration Stage' : stage.stage,
        date: stage.plenary_date,
        items: [stage],
      }
      seen.set(key, group)
      groups.push(group)
    }
  }

  for (const group of groups) {
    group.items.sort((a, b) =>
      a.stage.localeCompare(b.stage, undefined, { numeric: true, sensitivity: 'base' })
    )
  }

  groups.sort((a, b) => {
    const priorityDiff = getStagePriority(b.label) - getStagePriority(a.label)
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  return groups
}


function naturalCompareDesc(a: string, b: string): number {
  return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
}

function VotedOnList({ items }: { items: BillStageItem[] }) {
  const voted = items
    .filter(i => i.has_division && i.division_id)
    .sort((a, b) =>
      new Date(b.plenary_date).getTime() - new Date(a.plenary_date).getTime() ||
      naturalCompareDesc(a.item_title ?? '', b.item_title ?? '')
    )

  if (voted.length === 0) return null

  return (
    <div className={styles.itemColumn}>
      <div className={styles.itemColumnHeader}>
        Voted on <span className={styles.itemColumnCount}>({voted.length})</span>
      </div>
      <ul className={styles.itemColumnList} role="list">
        {voted.map(item => {
          const itemPassed = item.outcome ? isPassed(item.outcome) : null
          return (
            <li key={item.document_id} className={styles.itemColumnRowWrap}>
              <Link href={`/assembly/divisions/${item.division_id}`} className={styles.itemColumnRow}>
                {(item.item_title || item.outcome) && (
                  <span className={`${styles.itemLabel} ${styles.votedTitle}`}>
                    {item.item_title ?? item.outcome}
                  </span>
                )}
                <span className={`${styles.itemColumnDate} ${styles.votedDate}`}>{formatDate(item.plenary_date)}</span>
                {itemPassed !== null && (
                  <span className={`${itemPassed ? styles.pillPassed : styles.pillFailed} ${styles.votedPill}`} role="status">
                    {itemPassed ? 'Passed' : 'Failed'}
                  </span>
                )}
                <span className={`${styles.divisionLink} ${styles.divisionLinkSm} ${styles.votedLink}`} aria-hidden="true">
                  View vote results <span aria-hidden="true">↗</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function NoVoteList({ items }: { items: BillStageItem[] }) {
  const noVote = items
    .filter(i => !i.has_division || !i.division_id)
    .sort((a, b) => naturalCompareDesc(a.item_title ?? '', b.item_title ?? ''))

  if (noVote.length === 0) return null

  return (
    <div className={styles.itemColumn}>
      <div className={styles.itemColumnHeader}>
        Not voted on <span className={styles.itemColumnCount}>({noVote.length})</span>
      </div>
      <ul className={styles.itemColumnList} role="list">
        {noVote.map(item => (
          <li key={item.document_id} className={styles.itemColumnRow}>
            <span className={styles.itemLabelMuted}>{item.item_title ?? ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StageGroupRow({ group, billConfirmedPassed }: { group: StageGroup; billConfirmedPassed: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const hasMultiple = group.items.length > 1
  const singleItem = !hasMultiple ? group.items[0] : null
  const passed = singleItem?.outcome ? isPassed(singleItem.outcome) : null
  const isCrossCommunity = group.items.some(s => s.division_type === 'Cross-Community')
  const isFinalStage = /final stage/i.test(group.label)
  const stageInPast = new Date(group.date) <= new Date()
  const agreedWithoutVote = isFinalStage
    && stageInPast
    && billConfirmedPassed
    && group.items.every(i => !i.has_division && !i.division_id)

  return (
    <li className={styles.stageGroup}>
      <div className={styles.stageHeader}>
        <span className={styles.stageDate}>{formatDate(group.date)}</span>
        <div className={styles.stageLabelRow}>
          <span className={styles.stageLabel}>{group.label}</span>
          {passed !== null && (
            <span className={passed ? styles.pillPassed : styles.pillFailed} role="status">
              {passed ? 'Passed' : 'Failed'}
            </span>
          )}
          {agreedWithoutVote && (
            <span className={styles.pillAgreed} role="status">Agreed</span>
          )}
          {isCrossCommunity && (
            <span className={styles.pillCrossCommunity}>Cross-community</span>
          )}
        </div>
      </div>

      <VotedOnList items={group.items} />

      {hasMultiple && group.items.some(i => !i.has_division || !i.division_id) && (
        <div className={styles.groupMeta}>
          <button
            className={styles.expandBtn}
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
          >
            {expanded
              ? 'Hide'
              : `Not voted on (${group.items.filter(i => !i.has_division || !i.division_id).length})`}
          </button>
        </div>
      )}

      {expanded && hasMultiple && <NoVoteList items={group.items} />}
    </li>
  )
}

interface Props {
  stages: BillStageItem[]
  royalAssentDate?: string | null
  latestDate?: string | null
}

export default function BillTimeline({ stages, royalAssentDate, latestDate }: Props) {
  const groups = groupAndSortStages(stages)
  const billConfirmedPassed = !!royalAssentDate || (
    !!latestDate && new Date(latestDate) <= new Date()
  )

  return (
    <ol className={styles.stageList} role="list">
      {royalAssentDate && (
        <li className={styles.stageGroup}>
          <div className={styles.stageHeader}>
            <span className={styles.stageDate}>{formatDate(royalAssentDate)}</span>
            <div className={styles.stageLabelRow}>
              <span className={styles.stageLabel}>Royal Assent</span>
              <span className={styles.pillBecameLaw} role="status">Became law</span>
            </div>
          </div>
        </li>
      )}
      {groups.map(group => (
        <StageGroupRow key={`${group.label}-${group.date}`} group={group} billConfirmedPassed={billConfirmedPassed} />
      ))}
    </ol>
  )
}
