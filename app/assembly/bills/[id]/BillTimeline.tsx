'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, XCircle, Vote, Users } from 'lucide-react'
import { isPassed } from '@/lib/bills'
import { useMandate } from '@/components/MandateContext'
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

function dateBlock(raw: string) {
  const [year, month, day] = raw.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  const weekday = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
  return { weekday, day, monthYear: `${MONTHS[month - 1]} ${year}` }
}

function DateBlock({ date }: { date: string }) {
  const d = dateBlock(date)
  if (!d) return <span className={styles.date} aria-hidden="true" />
  return (
    <span className={styles.date}>
      <span className={styles.dateWeekday}>{d.weekday}</span>
      <span className={styles.dateNum}>{d.day}</span>
      <span className={styles.dateMonth}>{d.monthYear}</span>
    </span>
  )
}

function OutcomePill({ passed }: { passed: boolean }) {
  return (
    <span className={styles.pill} data-tone={passed ? 'law' : 'failed'}>
      {passed ? <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" /> : <XCircle size={14} strokeWidth={2} aria-hidden="true" />}
      {passed ? 'Passed' : 'Failed'}
    </span>
  )
}

interface RowData {
  key: string
  label: string
  date: string
  voted: BillStageItem[]
  noVote: BillStageItem[]
  singlePassed: boolean | null
  agreed: boolean
  crossCommunity: boolean
  scheduled: boolean
}

function buildRow(group: StageGroup, billConfirmedPassed: boolean, today: string): RowData {
  const hasMultiple = group.items.length > 1
  const singleItem = !hasMultiple ? group.items[0] : null
  const isFinalStage = /final stage/i.test(group.label)
  const stageInPast = group.date.slice(0, 10) <= today
  const voted = group.items
    .filter(i => i.has_division && i.division_id)
    .sort((a, b) =>
      new Date(b.plenary_date).getTime() - new Date(a.plenary_date).getTime() ||
      naturalCompareDesc(a.item_title ?? '', b.item_title ?? '')
    )
  const noVote = hasMultiple
    ? group.items
        .filter(i => (!i.has_division || !i.division_id) && i.item_title)
        .sort((a, b) => naturalCompareDesc(a.item_title ?? '', b.item_title ?? ''))
    : []
  return {
    key: `${group.label}-${group.date}`,
    label: group.label,
    date: group.date,
    voted,
    noVote,
    singlePassed: singleItem?.outcome ? isPassed(singleItem.outcome) : null,
    agreed: isFinalStage && stageInPast && billConfirmedPassed && group.items.every(i => !i.has_division && !i.division_id),
    crossCommunity: group.items.some(s => s.division_type === 'Cross-Community'),
    scheduled: !stageInPast,
  }
}

function StageHead({ row, count }: { row: RowData; count: number }) {
  return (
    <>
      <DateBlock date={row.date} />
      <span className={styles.headText}>
        <span className={styles.headLabel}>{row.label}</span>
        <span className={styles.headPills}>
          {row.scheduled && <span className={styles.scheduledTag}>Scheduled</span>}
          {row.singlePassed !== null && <OutcomePill passed={row.singlePassed} />}
          {row.agreed && (
            <span className={styles.pill} data-tone="law">
              <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
              Agreed
            </span>
          )}
          {row.crossCommunity && (
            <span className={styles.pill} data-tone="indigo">
              <Users size={14} strokeWidth={2} aria-hidden="true" />
              Cross-community
            </span>
          )}
          {count > 1 && (
            <span className={styles.pill}>
              <Vote size={14} strokeWidth={2} aria-hidden="true" />
              {count} votes
            </span>
          )}
        </span>
      </span>
    </>
  )
}

function StageBody({ row }: { row: RowData }) {
  const { basePath } = useMandate()
  return (
    <div className={styles.body}>
      {row.voted.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupIcon}><Vote size={16} strokeWidth={2} aria-hidden="true" /></span>
            Voted on ({row.voted.length})
          </div>
          <ul className={styles.list} role="list">
            {row.voted.map(item => {
              const itemPassed = item.outcome ? isPassed(item.outcome) : null
              return (
                <li key={item.document_id}>
                  <Link
                    href={`${basePath}/assembly/divisions/${item.division_id}`}
                    title={item.item_title ?? item.outcome ?? undefined}
                    className={`${styles.entry} ${styles.entryLink} ${styles.voteRow}`}
                  >
                    <span className={styles.voteTop}>
                      <span className={styles.entryTitle}>{item.item_title ?? item.outcome}</span>
                      {itemPassed !== null && <OutcomePill passed={itemPassed} />}
                    </span>
                    {item.total_ayes !== null && item.total_noes !== null && item.total_ayes + item.total_noes > 0 && (
                      <span className={styles.voteBar}>
                        <span className={styles.voteSplit} aria-hidden="true">
                          {item.total_ayes > 0 && <span className={styles.voteAye} style={{ flexGrow: item.total_ayes }} />}
                          {item.total_noes > 0 && <span className={styles.voteNo} style={{ flexGrow: item.total_noes }} />}
                        </span>
                        <span className={styles.voteCounts}>
                          <span>Aye <b>{item.total_ayes}</b></span>
                          <span>No <b>{item.total_noes}</b></span>
                        </span>
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {row.noVote.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupIcon}><Users size={16} strokeWidth={2} aria-hidden="true" /></span>
            Not voted on ({row.noVote.length})
          </div>
          <ul className={styles.list} role="list">
            {row.noVote.map(item => (
              <li key={item.document_id}>
                <span className={`${styles.entry} ${styles.entryMuted}`}>
                  <span className={styles.entryTitle}>{item.item_title}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface Props {
  stages: BillStageItem[]
  royalAssentDate?: string | null
  latestDate?: string | null
  today: string
}

export default function BillTimeline({ stages, royalAssentDate, latestDate, today }: Props) {
  const uid = useId()
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const billConfirmedPassed = !!royalAssentDate || (!!latestDate && latestDate.slice(0, 10) <= today)
  const rows = groupAndSortStages(stages).map(g => buildRow(g, billConfirmedPassed, today))
  const expandable = rows.filter(r => r.voted.length + r.noVote.length > 0)
  const allOpen = expandable.length > 0 && open.size === expandable.length

  const toggle = (key: string) =>
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className={styles.timeline}>
      {expandable.length > 1 && (
        <div className={styles.timelineBar}>
          <button
            type="button"
            className={styles.toggleAll}
            onClick={() => setOpen(allOpen ? new Set() : new Set(expandable.map(r => r.key)))}
          >
            <span className={styles.toggleStack}>
              <span className={allOpen ? styles.hidden : undefined} aria-hidden={allOpen}>Expand all</span>
              <span className={allOpen ? undefined : styles.hidden} aria-hidden={!allOpen}>Collapse all</span>
            </span>
          </button>
        </div>
      )}

      <ol className={styles.rail} role="list">
        {royalAssentDate && (
          <li className={`${styles.item} ${styles.itemLaw}`}>
            <span className={styles.track} aria-hidden="true"><span className={styles.nodeDot} /></span>
            <div className={styles.card}>
              <h3 className={styles.stageHeading}>
              <span className={styles.head}>
                <DateBlock date={royalAssentDate} />
                <span className={styles.headText}>
                  <span className={styles.headLabel}>Royal Assent</span>
                  <span className={styles.headPills}>
                    <span className={styles.pill} data-tone="law">
                      <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
                      Became law
                    </span>
                  </span>
                </span>
              </span>
              </h3>
            </div>
          </li>
        )}
        {rows.map(row => {
          const canOpen = row.voted.length + row.noVote.length > 0
          const isOpen = open.has(row.key)
          const id = `${uid}-${row.key.replace(/[^a-z0-9]+/gi, '-')}`
          return (
            <li key={row.key} className={`${styles.item} ${row.scheduled ? styles.itemScheduled : ''} ${isOpen ? styles.open : ''}`}>
              <span className={styles.track} aria-hidden="true"><span className={styles.nodeDot} /></span>
              <div className={styles.card}>
                {canOpen ? (
                  <>
                    <h3 className={styles.stageHeading}>
                      <button
                        type="button"
                        className={styles.head}
                        id={`${id}-head`}
                        aria-expanded={isOpen}
                        aria-controls={`${id}-panel`}
                        onClick={() => toggle(row.key)}
                      >
                        <StageHead row={row} count={row.voted.length} />
                        <span className={styles.chev}><ChevronDown size={18} strokeWidth={2} aria-hidden="true" /></span>
                      </button>
                    </h3>
                    <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-head`} className={styles.panel}>
                      <div className={styles.panelInner}>
                        <StageBody row={row} />
                      </div>
                    </div>
                  </>
                ) : (
                  <h3 className={styles.stageHeading}>
                    <span className={styles.head}>
                      <StageHead row={row} count={0} />
                    </span>
                  </h3>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
