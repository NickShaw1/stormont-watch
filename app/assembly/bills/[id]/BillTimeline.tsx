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

  // Natural sort within each group
  for (const group of groups) {
    group.items.sort((a, b) =>
      a.stage.localeCompare(b.stage, undefined, { numeric: true, sensitivity: 'base' })
    )
  }

  // Sort by legislative stage priority descending, date as tiebreaker
  groups.sort((a, b) => {
    const priorityDiff = getStagePriority(b.label) - getStagePriority(a.label)
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  return groups
}


function StageGroupRow({ group }: { group: StageGroup }) {
  const [expanded, setExpanded] = useState(false)
  const hasMultiple = group.items.length > 1
  const singleItem = !hasMultiple ? group.items[0] : null
  const singleDivisionId = singleItem?.division_id ?? null
  const passed = singleItem?.outcome ? isPassed(singleItem.outcome) : null
  const isCrossCommunity = group.items.some(s => s.division_type === 'Cross-Community')

  const itemsWithDivision = hasMultiple ? group.items.filter(i => i.has_division && i.division_id) : []
  const itemsWithoutDivision = hasMultiple ? group.items.filter(i => !i.has_division || !i.division_id) : []
  const noDivisionsAtAll = hasMultiple && itemsWithDivision.length === 0

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
          {isCrossCommunity && (
            <span className={styles.pillCrossCommunity}>Cross-community</span>
          )}
        </div>
        {singleItem?.outcome && (
          <p className={styles.divisionOutcome}>{singleItem.outcome}</p>
        )}
        {singleDivisionId && (
          <ul className={styles.divisionLinkList}>
            <li>
              <Link
                href={`/assembly/divisions/${singleDivisionId}`}
                className={styles.divisionLink}
              >
                View vote results <span aria-hidden="true">↗</span>
              </Link>
            </li>
          </ul>
        )}
        {hasMultiple && noDivisionsAtAll && (
          <p className={styles.noVoteSummary}>
            {group.items.length} item{group.items.length !== 1 ? 's' : ''} considered without a recorded vote
          </p>
        )}
        {hasMultiple && !noDivisionsAtAll && (
          <div className={styles.groupMeta}>
            <button
              className={styles.expandBtn}
              onClick={() => setExpanded(e => !e)}
              aria-expanded={expanded}
            >
              {expanded ? 'Hide items' : `Show ${group.items.length} items`}
            </button>
          </div>
        )}
      </div>

      {expanded && hasMultiple && !noDivisionsAtAll && (
        <ul className={styles.stageItems} role="list">
          {itemsWithDivision.map(item => {
            const itemPassed = item.outcome ? isPassed(item.outcome) : null
            const itemLabel = item.stage
              .replace(/\s*-\s*Consideration Stage$/i, '')
              .replace(/\s*Consideration Stage$/i, '')
              .trim()
            return (
              <li key={item.document_id} className={styles.stageItem}>
                <span className={styles.itemLabel}>{itemLabel}</span>
                <Link
                  href={`/assembly/divisions/${item.division_id}`}
                  className={styles.divisionLink}
                >
                  {itemPassed === true ? 'Passed' : itemPassed === false ? 'Failed' : 'View vote'} <span aria-hidden="true">↗</span>
                </Link>
              </li>
            )
          })}
          {itemsWithoutDivision.length > 0 && (
            <li className={styles.stageItem}>
              <span className={styles.noVoteSummary}>
                {itemsWithoutDivision.length} further item{itemsWithoutDivision.length !== 1 ? 's' : ''} considered without a recorded vote
              </span>
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

interface Props {
  stages: BillStageItem[]
  royalAssentDate?: string | null
}

export default function BillTimeline({ stages, royalAssentDate }: Props) {
  const groups = groupAndSortStages(stages)

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
        <StageGroupRow key={`${group.label}-${group.date}`} group={group} />
      ))}
    </ol>
  )
}
