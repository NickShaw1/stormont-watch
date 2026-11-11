'use client'

import { useId, useState } from 'react'
import { CalendarClock, CalendarDays, CalendarRange, CheckCircle2, ChevronDown, History, FileText, Gavel, ShieldAlert, User, Users, Vote } from 'lucide-react'
import { isPassed } from '@/lib/bills'
import {
  committeeItemTitle,
  eventLabel,
  isProceduralEvent,
  parseExtensionDeadline,
  type CommitteeSummary,
} from '@/lib/bills/billActivity'
import { formatDate, formatMemberName } from '@/lib/format'
import type { BillCommitteeRow, BillStageRow, BillTablerRow } from '@/lib/db/queries'
import type { LucideIcon } from 'lucide-react'
import { useMandate } from '@/components/MandateContext'
import PetitionPill from '@/components/PetitionPill'
import { OutcomePill, VoteCard } from './VoteCard'
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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getStagePriority(stage: string): number {
  const s = stage.toLowerCase()
  for (const [key, val] of Object.entries(STAGE_PRIORITY)) {
    if (s.includes(key)) return val
  }
  return 0
}

export type BillStageItem = BillStageRow

interface StageGroup {
  label: string
  date: string
  items: BillStageItem[]
}

function groupStages(stages: BillStageItem[]): StageGroup[] {
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

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

interface EventBase {
  key: string
  date: string
  scheduled: boolean
  rank: number
  hasVotes: boolean
  expandable: boolean
  plenary: boolean
}

interface StageEvent extends EventBase {
  kind: 'stage'
  label: string
  stageNumber: number | null
  voted: BillStageItem[]
  oral: BillStageItem[]
  noVote: BillStageItem[]
  petitioned: Map<string, string>
  day: number | null
  singlePassed: boolean | null
  agreed: boolean
  petitionNoted: string | null
  crossCommunity: boolean
}

interface ProceduralEvent extends EventBase {
  kind: 'procedural'
  label: string
  eventType: string
  text: string | null
  deadline: string | null
  vote: BillStageItem | null
  oralOutcome: string | null
  tablers: BillTablerRow[]
}

interface PetitionEvent extends EventBase {
  kind: 'petition'
  count: number
  amendments: string
  label?: string
  note?: string
}

interface CommitteeMonth {
  label: string
  rows: { key: string; date: string; committee: string; title: string }[]
}

interface CommitteeEvent extends EventBase {
  kind: 'committee'
  label: string
  stageNumber: number | null
  committees: string[]
  meetingCount: number
  first: string
  last: string
  ongoing: boolean
  notes: string[]
  months: CommitteeMonth[]
}

type TimelineEvent = StageEvent | ProceduralEvent | PetitionEvent | CommitteeEvent

function committeeNotes(summary: CommitteeSummary | null): string[] {
  if (!summary) return []
  const notes: string[] = []
  if (summary.currentDeadline) {
    notes.push(`Deadline ${formatDate(summary.currentDeadline)}`)
  }
  if (summary.nextMeeting) notes.push(`Next meeting ${formatDate(summary.nextMeeting)}`)
  return notes
}

function stageNumberOf(label: string): number | null {
  const l = label.toLowerCase()
  if (l.includes('further consideration')) return 5
  if (l.includes('consideration')) return 4
  if (l.includes('final stage')) return 6
  if (l.includes('committee stage')) return 3
  if (l.includes('second stage')) return 2
  if (l.includes('first stage')) return 1
  return null
}

function sittingDay(items: BillStageItem[]): number | null {
  const days = items
    .map(i => i.raw_title?.match(/\(Day\s+(\d+)\)/i)?.[1])
    .filter((d): d is string => !!d)
    .map(Number)
  return days.length > 0 ? Math.min(...days) : null
}

function buildStageEvent(group: StageGroup, billConfirmedPassed: boolean, today: string): StageEvent {
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
  const undivided = (i: BillStageItem) => !i.has_division || !i.division_id
  const oral = hasMultiple
    ? group.items
        .filter(i => undivided(i) && i.item_title && i.decision_method)
        .sort((a, b) => naturalCompareDesc(a.item_title ?? '', b.item_title ?? ''))
    : []
  const noVote = hasMultiple
    ? group.items
        .filter(i => undivided(i) && i.item_title && !i.decision_method)
        .sort((a, b) => naturalCompareDesc(a.item_title ?? '', b.item_title ?? ''))
    : []
  return {
    kind: 'stage',
    key: `stage-${group.label}-${group.date}`,
    date: group.date.slice(0, 10),
    label: group.label,
    stageNumber: stageNumberOf(group.label),
    voted,
    oral,
    noVote,
    day: sittingDay(group.items),
    petitioned: new Map(group.items.flatMap(i => (i.petition_plenary_date ? [[i.document_id, i.petition_plenary_date.slice(0, 10)] as [string, string]] : []))),
    singlePassed: isPassed(singleItem?.outcome ?? singleItem?.decision_outcome),
    agreed: isFinalStage && stageInPast && billConfirmedPassed && group.items.every(i => !i.has_division && !i.division_id && !i.decision_outcome),
    petitionNoted: group.items.map(i => i.hansard_petition_date).find((d): d is string => !!d)?.slice(0, 10) ?? null,
    crossCommunity: group.items.some(s => s.division_type === 'Cross-Community'),
    scheduled: !stageInPast,
    rank: 10 - getStagePriority(group.label),
    hasVotes: voted.length > 0,
    expandable: voted.length + oral.length + noVote.length > 0,
    plenary: true,
  }
}

function buildEvents(
  stages: BillStageItem[],
  committeeItems: BillCommitteeRow[],
  tablersByDoc: Record<string, BillTablerRow[]>,
  billConfirmedPassed: boolean,
  today: string,
  committeeInferred: boolean,
  summary: CommitteeSummary | null,
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const g of groupStages(stages.filter(s => s.event_type === 'stage'))) {
    events.push(buildStageEvent(g, billConfirmedPassed, today))
  }

  for (const s of stages.filter(r => isProceduralEvent(r.event_type))) {
    const date = s.plenary_date.slice(0, 10)
    const vote = s.has_division && s.division_id ? s : null
    const tablers = tablersByDoc[s.document_id] ?? []
    const text = s.item_text
    events.push({
      kind: 'procedural',
      key: `procedural-${s.document_id}`,
      date,
      label: eventLabel(s),
      eventType: s.event_type,
      text,
      deadline: s.event_type === 'extension' ? parseExtensionDeadline(text) : null,
      vote,
      oralOutcome: !vote && s.decision_method === 'Oral Vote' ? s.decision_outcome : null,
      tablers,
      scheduled: date > today,
      rank: 20,
      hasVotes: vote !== null,
      expandable: !!text || vote !== null || (!vote && s.decision_method === 'Oral Vote') || tablers.length > 0,
      plenary: true,
    })
  }

  const petitionsByDay = new Map<string, BillStageItem[]>()
  for (const s of stages.filter(r => r.event_type === 'petition_of_concern')) {
    const date = s.plenary_date.slice(0, 10)
    petitionsByDay.set(date, [...(petitionsByDay.get(date) ?? []), s])
  }
  for (const [date, rows] of petitionsByDay) {
    const numbers = rows
      .map(r => (r.raw_title ?? '').match(/Amendment\s+(\d+)/i)?.[1])
      .filter((n): n is string => !!n)
      .map(Number)
      .sort((a, b) => a - b)
    const amendments = numbers.length === 0
      ? ''
      : numbers.length === 1
        ? `Amendment ${numbers[0]}`
        : `Amendments ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`
    events.push({
      kind: 'petition',
      key: `petition-${date}`,
      date,
      count: rows.length,
      amendments,
      scheduled: date > today,
      rank: 30,
      hasVotes: false,
      expandable: false,
      plenary: true,
    })
  }

  const notedPetitionDates = [...new Set(stages.map(r => r.hansard_petition_date?.slice(0, 10)).filter((d): d is string => !!d))]
  for (const date of notedPetitionDates) {
    events.push({
      kind: 'petition',
      key: `petition-noted-${date}`,
      date,
      count: 1,
      amendments: '',
      label: 'Petition of Concern tabled',
      note: 'The Final Stage vote was deferred for a 14-day consideration period.',
      scheduled: false,
      rank: 30,
      hasVotes: false,
      expandable: false,
      plenary: true,
    })
  }

  const stageDates = stages.filter(r => r.event_type === 'stage').map(r => ({ stage: r.stage.toLowerCase(), date: r.plenary_date.slice(0, 10) }))
  const secondStage = stageDates.filter(r => r.stage === 'second stage').map(r => r.date).sort()[0] ?? null
  const firstConsideration = stageDates.filter(r => r.stage.includes('consideration')).map(r => r.date).sort()[0] ?? null

  const buckets = new Map<string, { label: string; stageNumber: number | null; rows: BillCommitteeRow[] }>()
  for (const c of committeeItems) {
    const d = c.meeting_date
    const bucket = !secondStage ? 'all'
      : d < secondStage ? 'before'
      : firstConsideration && d >= firstConsideration ? 'later'
      : 'stage'
    const meta = bucket === 'before' ? { label: 'Before Second Stage', stageNumber: null }
      : bucket === 'stage' ? { label: 'Committee Stage', stageNumber: 3 }
      : bucket === 'later' ? { label: 'Later committee meetings', stageNumber: null }
      : { label: 'Committee meetings', stageNumber: null }
    const entry = buckets.get(bucket) ?? { ...meta, rows: [] }
    entry.rows.push(c)
    buckets.set(bucket, entry)
  }
  for (const [bucket, b] of buckets) {
    const dates = b.rows.map(r => r.meeting_date).sort()
    const byMonth = new Map<string, CommitteeMonth>()
    for (const r of [...b.rows].sort((x, y) => y.meeting_date.localeCompare(x.meeting_date) || x.item_order - y.item_order)) {
      const [y, m] = r.meeting_date.split('-').map(Number)
      const label = `${MONTH_NAMES[m - 1]} ${y}`
      const month = byMonth.get(label) ?? { label, rows: [] }
      month.rows.push({
        key: `${r.event_id}-${r.item_id}-${r.item_order}`,
        date: r.meeting_date,
        committee: r.committee_name.trim(),
        title: committeeItemTitle(r),
      })
      byMonth.set(label, month)
    }
    const last = dates[dates.length - 1]
    events.push({
      kind: 'committee',
      key: `committee-${bucket}`,
      date: last,
      label: b.label,
      stageNumber: b.stageNumber,
      committees: [...new Set(b.rows.map(r => r.committee_name.trim()))],
      meetingCount: new Set(b.rows.map(r => r.event_id)).size,
      first: dates[0],
      last,
      ongoing: bucket === 'stage' && !firstConsideration && !billConfirmedPassed,
      notes: bucket === 'stage' ? committeeNotes(summary) : [],
      months: [...byMonth.values()],
      scheduled: last > today,
      rank: 40,
      hasVotes: false,
      expandable: true,
      plenary: false,
    })
  }

  if (committeeInferred && secondStage && !buckets.has('stage')) {
    events.push({
      kind: 'committee',
      key: 'committee-empty',
      date: secondStage,
      label: 'Committee Stage',
      stageNumber: 3,
      committees: [],
      meetingCount: 0,
      first: secondStage,
      last: secondStage,
      ongoing: true,
      notes: committeeNotes(summary),
      months: [],
      scheduled: false,
      rank: 7,
      hasVotes: false,
      expandable: false,
      plenary: false,
    })
  }

  return events.sort((a, b) => b.date.localeCompare(a.date) || a.rank - b.rank || a.key.localeCompare(b.key))
}

function tablerText(tablers: BillTablerRow[]): string {
  return tablers
    .map(t => {
      const role = t.tabler_title && !/^MLA\b/i.test(t.tabler_title) ? `, ${t.tabler_title}` : ''
      return `${formatMemberName(t.tabler_name)}${role}`
    })
    .join('; ')
}

function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

function PetitionDatePill({ petitionDate, itemDate }: { petitionDate: string; itemDate: string }) {
  return <PetitionPill>Petition of Concern{petitionDate !== itemDate ? `, ${shortDate(petitionDate)}` : ''}</PetitionPill>
}

interface InfoPill {
  label: string
  Icon?: LucideIcon
  tone?: 'neutral' | 'teal' | 'indigo' | 'date'
}

function headLines(event: TimelineEvent, count: number): { label: string; lines: string[]; pills: InfoPill[] } {
  if (event.kind === 'stage') {
    const pills: InfoPill[] = []
    if (event.day !== null) pills.push({ label: `Day ${event.day}` })
    if (count > 0) pills.push({ label: plural(count, 'vote', 'votes'), Icon: Vote })
    if (event.oral.length > 0) pills.push({ label: plural(event.oral.length, 'oral vote', 'oral votes'), Icon: Gavel })
    if (event.crossCommunity) pills.push({ label: 'Cross-community', Icon: Users, tone: 'indigo' })
    return { label: event.label, lines: [], pills }
  }
  if (event.kind === 'procedural') {
    const pills: InfoPill[] = [{ label: 'Procedural', Icon: Gavel }]
    if (event.deadline) pills.push({ label: `Extension to ${formatDate(event.deadline)}`, Icon: CalendarRange, tone: 'date' })
    return { label: event.label, lines: [], pills }
  }
  if (event.kind === 'petition') {
    return { label: event.label ?? 'Petitions of Concern confirmed', lines: event.note ? [event.note] : event.amendments ? [event.amendments] : [], pills: [] }
  }
  const pills: InfoPill[] = []
  if (event.meetingCount > 0) {
    pills.push({ label: plural(event.meetingCount, 'meeting', 'meetings'), Icon: Users, tone: 'teal' })
    pills.push({ label: event.first === event.last ? formatDate(event.first) : `${formatDate(event.first)} to ${formatDate(event.last)}`, Icon: CalendarRange })
  }
  for (const n of event.notes) pills.push({ label: n, Icon: CalendarClock, tone: 'date' })
  const lines = event.meetingCount === 0
    ? ['No committee meetings are recorded in the Assembly API yet.']
    : [event.committees.join(' and ')]
  return { label: event.label, lines, pills }
}

function EventHead({ event, count }: { event: TimelineEvent; count: number }) {
  const d = dateBlock(event.date)
  const { label, lines, pills } = headLines(event, count)
  const outcome = event.kind === 'procedural' ? isPassed(event.vote?.outcome ?? event.oralOutcome) : event.kind === 'stage' ? event.singlePassed : null
  const hasStatus = event.scheduled || outcome !== null || (event.kind === 'stage' && (event.agreed || (event.petitionNoted !== null && event.petitionNoted !== event.date))) || (event.kind === 'committee' && event.ongoing)
  return (
    <>
      <DateBlock date={event.date} />
      <span className={styles.headText}>
        {d && (
          <span className={`${styles.pill} ${styles.headDate}`} data-tone="date" aria-hidden="true">
            <CalendarDays size={14} strokeWidth={2} aria-hidden="true" />
            {`${d.weekday} ${d.day} ${d.monthYear}`}
          </span>
        )}
        <span className={styles.headLabel}>
          {event.kind === 'petition' && <ShieldAlert className={styles.labelIcon} size={18} strokeWidth={2} aria-hidden="true" />}
          {label}
        </span>
        {lines.map(line => <span key={line} className={styles.headNote}>{line}</span>)}
        {(hasStatus || pills.length > 0) && (
          <span className={styles.headPills}>
            {event.scheduled && <span className={styles.scheduledTag}>Scheduled</span>}
            {outcome !== null && <OutcomePill passed={outcome} />}
            {event.kind === 'stage' && event.agreed && (
              <span className={styles.pill} data-tone="law">
                <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
                Agreed
              </span>
            )}
            {event.kind === 'stage' && event.petitionNoted && event.petitionNoted !== event.date && <PetitionPill>{`Petition of Concern, ${shortDate(event.petitionNoted)}`}</PetitionPill>}
            {event.kind === 'committee' && event.ongoing && <span className={styles.pill} data-tone="date">In progress</span>}
            {pills.map(pill => (
              <span key={pill.label} className={styles.pill} data-tone={pill.tone ?? 'neutral'}>
                {pill.Icon && <pill.Icon size={14} strokeWidth={2} aria-hidden="true" />}
                {pill.label}
              </span>
            ))}
          </span>
        )}
      </span>
    </>
  )
}

function EventBody({ event, basePath }: { event: TimelineEvent; basePath: string }) {
  if (event.kind === 'stage') {
    return (
      <div className={styles.body}>
        {event.voted.length > 0 && (
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.groupIcon}><Vote size={16} strokeWidth={2} aria-hidden="true" /></span>
              Voted on ({event.voted.length})
            </div>
            <ul className={styles.list} role="list">
              {event.voted.map(item => (
                <li key={item.document_id}>
                  <VoteCard
                    basePath={basePath}
                    vote={{
                      divisionId: item.division_id as string,
                      title: item.item_title ?? item.outcome ?? '',
                      passed: item.outcome ? isPassed(item.outcome) : null,
                      ayes: item.total_ayes,
                      noes: item.total_noes,
                    }}
                    footer={event.petitioned.has(item.document_id) ? <PetitionDatePill petitionDate={event.petitioned.get(item.document_id) as string} itemDate={event.date} /> : undefined}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
        {event.oral.length > 0 && (
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.groupIcon}><Gavel size={16} strokeWidth={2} aria-hidden="true" /></span>
              Decided by oral vote ({event.oral.length})
            </div>
            <ul className={styles.list} role="list">
              {event.oral.map(item => {
                const passed = isPassed(item.decision_outcome)
                return (
                  <li key={item.document_id}>
                    <span className={`${styles.entry} ${styles.entryMuted}`}>
                      <span className={styles.entryTitle}>{item.item_title}</span>
                      <span className={styles.headPills}>
                        {event.petitioned.has(item.document_id) && <PetitionDatePill petitionDate={event.petitioned.get(item.document_id) as string} itemDate={event.date} />}
                        {passed !== null && <OutcomePill passed={passed} />}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {event.noVote.length > 0 && (
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.groupIcon}><Users size={16} strokeWidth={2} aria-hidden="true" /></span>
              No decision recorded ({event.noVote.length})
            </div>
            <ul className={styles.list} role="list">
              {event.noVote.map(item => (
                <li key={item.document_id}>
                  <span className={`${styles.entry} ${styles.entryMuted}`}>
                    <span className={styles.entryTitle}>{item.item_title}</span>
                    {event.petitioned.has(item.document_id) && <PetitionDatePill petitionDate={event.petitioned.get(item.document_id) as string} itemDate={event.date} />}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (event.kind === 'procedural') {
    return (
      <div className={styles.body}>
        {event.text && (
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.groupIcon}><FileText size={16} strokeWidth={2} aria-hidden="true" /></span>
              Motion
            </div>
            <span className={`${styles.entry} ${styles.entryMuted} ${styles.entryText}`}>
              <span className={styles.entryTitle}>{event.text}</span>
            </span>
          </div>
        )}
        {event.tablers.length > 0 && (
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.groupIcon}><User size={16} strokeWidth={2} aria-hidden="true" /></span>
              Tabled by
            </div>
            <span className={`${styles.entry} ${styles.entryMuted} ${styles.entryText}`}>
              <span className={styles.entryTitle}>{tablerText(event.tablers)}</span>
            </span>
          </div>
        )}
        {event.oralOutcome && (
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.groupIcon}><Gavel size={16} strokeWidth={2} aria-hidden="true" /></span>
              Decided by oral vote
            </div>
            <span className={`${styles.entry} ${styles.entryMuted}`}>
              <span className={styles.entryTitle}>{event.oralOutcome}</span>
              {isPassed(event.oralOutcome) !== null && <OutcomePill passed={isPassed(event.oralOutcome) === true} />}
            </span>
          </div>
        )}
        {event.vote && event.vote.division_id && (
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.groupIcon}><Vote size={16} strokeWidth={2} aria-hidden="true" /></span>
              Voted on (1)
            </div>
            <VoteCard
              basePath={basePath}
              vote={{
                divisionId: event.vote.division_id,
                title: event.vote.item_title ?? event.vote.outcome ?? event.label,
                passed: event.vote.outcome ? isPassed(event.vote.outcome) : null,
                ayes: event.vote.total_ayes,
                noes: event.vote.total_noes,
              }}
            />
          </div>
        )}
      </div>
    )
  }

  if (event.kind === 'committee') {
    const showCommittee = event.committees.length > 1
    return (
      <div className={styles.body}>
        {event.months.map(month => (
          <div key={month.label} className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.groupIcon}><Users size={16} strokeWidth={2} aria-hidden="true" /></span>
              {month.label} ({plural(month.rows.length, 'item', 'items')})
            </div>
            <ul className={styles.list} role="list">
              {month.rows.map(row => (
                <li key={row.key}>
                  <span className={`${styles.entry} ${styles.entryMuted} ${styles.entryMeeting}`}>
                    <span className={styles.meetingDate}>{formatDate(row.date).replace(/ \d{4}$/, '')}</span>
                    <span className={styles.entryTitle}>
                      {row.title}
                      {showCommittee && <span className={styles.meetingCommittee}>{row.committee}</span>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  return null
}

interface Props {
  stages: BillStageItem[]
  committeeItems: BillCommitteeRow[]
  tablersByDoc: Record<string, BillTablerRow[]>
  royalAssentDate?: string | null
  passed: boolean | null
  today: string
  committeeInferred: boolean
  committeeSummary: CommitteeSummary | null
}

export default function BillTimeline({ stages, committeeItems, tablersByDoc, royalAssentDate, passed, today, committeeInferred, committeeSummary }: Props) {
  const uid = useId()
  const { basePath } = useMandate()
  const [open, setOpen] = useState<Set<string>>(() => new Set())

  const billConfirmedPassed = !!royalAssentDate || passed === true
  const visible = buildEvents(stages, committeeItems, tablersByDoc, billConfirmedPassed, today, committeeInferred, committeeSummary)
  const expandable = visible.filter(e => e.expandable)
  const allOpen = expandable.length > 0 && expandable.every(e => open.has(e.key))

  const toggle = (key: string) =>
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <>
      <div className={styles.tileHead}>
        <span className={`${styles.iconTile} ${styles.tnBlue}`}><History size={22} strokeWidth={2} aria-hidden="true" /></span>
        <h2 className={styles.tileTitle} id="stages-heading">Legislative timeline</h2>
        {expandable.length > 1 && (
          <button
            type="button"
            className={styles.toggleAll}
            onClick={() => setOpen(prev => {
              const next = new Set(prev)
              if (allOpen) expandable.forEach(e => next.delete(e.key))
              else expandable.forEach(e => next.add(e.key))
              return next
            })}
          >
            <span className={styles.toggleStack}>
              <span className={allOpen ? styles.hidden : undefined} aria-hidden={allOpen}>Expand all</span>
              <span className={allOpen ? undefined : styles.hidden} aria-hidden={!allOpen}>Collapse all</span>
            </span>
          </button>
        )}
      </div>
      <p className={styles.tileDesc}>
        Every plenary day and committee meeting recorded for this bill, newest first. <span className={styles.hideSm}>A stage can appear more than once if the Assembly sat on it across several days. </span>Introduction and First Stage are not recorded in the Assembly API data used here.
      </p>
      <div className={styles.timeline}>
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
        {visible.map(event => {
          const isOpen = open.has(event.key)
          const id = `${uid}-${event.key.replace(/[^a-z0-9]+/gi, '-')}`
          const voteCount = event.kind === 'stage' ? event.voted.length : 0
          const kindClass = event.kind === 'stage' ? '' : event.kind === 'petition' ? styles.itemPetition : `${styles.itemQuiet} ${event.kind === 'committee' ? styles.itemCommittee : styles.itemProcedural}`
          return (
            <li key={event.key} className={`${styles.item} ${kindClass} ${event.scheduled ? styles.itemScheduled : ''} ${isOpen ? styles.open : ''}`}>
              <span className={styles.track} aria-hidden="true"><span className={styles.nodeDot} /></span>
              <div className={styles.card}>
                {event.kind === 'petition' && <ShieldAlert className={styles.itemMark} size={120} strokeWidth={1.5} aria-hidden="true" />}
                {event.expandable ? (
                  <>
                    <h3 className={styles.stageHeading}>
                      <button
                        type="button"
                        className={styles.head}
                        id={`${id}-head`}
                        aria-expanded={isOpen}
                        aria-controls={`${id}-panel`}
                        onClick={() => toggle(event.key)}
                      >
                        <EventHead event={event} count={voteCount} />
                        <span className={styles.chev}><ChevronDown size={18} strokeWidth={2} aria-hidden="true" /></span>
                      </button>
                    </h3>
                    <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-head`} className={styles.panel}>
                      <div className={styles.panelInner}>
                        <EventBody event={event} basePath={basePath} />
                      </div>
                    </div>
                  </>
                ) : (
                  <h3 className={styles.stageHeading}>
                    <span className={styles.head}>
                      <EventHead event={event} count={0} />
                    </span>
                  </h3>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      </div>
    </>
  )
}
