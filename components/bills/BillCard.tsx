import Link from 'next/link'
import { ArrowRight, Zap, CheckCircle2, CalendarDays } from 'lucide-react'
import { BILL_STAGES } from '@/lib/bills/billProgress'
import styles from './billCard.module.css'

export type BillKind = 'scheduled' | 'active' | 'awaiting' | 'law' | 'failed'

export interface BillProgress {
  stageIdx: number
  scheduledIdx: number | null
}

interface BillCardProps {
  href: string
  billId: string
  billType: string | null
  title: string
  kind: BillKind
  accelerated?: boolean
  lines?: string[]
  facts?: { label: string; value: string }[]
  progress: BillProgress
}

export const NUMBERED_STAGES = BILL_STAGES.slice(1)
const STAGE_COUNT = NUMBERED_STAGES.length

const KIND_LABEL: Partial<Record<BillKind, string>> = {
  awaiting: 'Awaiting Royal Assent',
  law: 'Became law',
  failed: 'Defeated',
}

export function railModel(progress: BillProgress, kind: BillKind) {
  const { stageIdx, scheduledIdx } = progress
  const awaiting = kind === 'awaiting'
  const pendingIdx = awaiting ? STAGE_COUNT : scheduledIdx
  const completedUpTo = kind === 'law' ? STAGE_COUNT : awaiting ? STAGE_COUNT - 1 : scheduledIdx !== null ? scheduledIdx - 1 : Math.max(stageIdx, 1)
  const stateOf = (i: number) => (i <= completedUpTo ? 'done' : i === pendingIdx ? 'scheduled' : undefined)
  const done = Math.min(Math.max(completedUpTo, 0), STAGE_COUNT)
  const kindLabel = KIND_LABEL[kind]
  const scheduledStage = kind === 'scheduled' && scheduledIdx !== null ? NUMBERED_STAGES[scheduledIdx - 1] : undefined
  const label = kindLabel ?? (scheduledStage ? `${scheduledStage} scheduled` : done > 0 ? NUMBERED_STAGES[done - 1] : 'First Stage')
  const nodes = NUMBERED_STAGES.map((stage, j) => {
    const i = j + 1
    const baseState = stateOf(i)
    const state = baseState === 'done' && i === done && done < STAGE_COUNT && pendingIdx === null ? 'current' : baseState
    return {
      stage,
      index: i,
      state,
      left: j > 0 && stateOf(i - 1) === 'done' ? stateOf(i) : undefined,
      right: j < STAGE_COUNT - 1 && stateOf(i) === 'done' ? stateOf(i + 1) : undefined,
    }
  })
  return { label, nodes }
}

export function splitBillId(billId: string) {
  const match = billId.match(/^(.*?)\s*(\d+)\/(\d{2}-\d{2})$/)
  return { prefix: match ? match[1] : null, number: match ? match[2] : billId }
}

function Rail({ progress, kind }: { progress: BillProgress; kind: BillKind }) {
  const { label, nodes } = railModel(progress, kind)

  return (
    <div className={styles.progress}>
      <span className={styles.progressLabels}>
        <span className={styles.progressName}>{label}</span>
      </span>
      <span className={styles.rail} aria-hidden="true">
        {nodes.map((n) => (
          <span key={n.stage} className={styles.step} data-state={n.state} data-left={n.left} data-right={n.right}>
            <span className={styles.node}>{n.index}</span>
          </span>
        ))}
      </span>
    </div>
  )
}

export default function BillCard({ href, billId, billType, title, kind, accelerated, lines = [], facts = [], progress }: BillCardProps) {
  const enactedDate = facts.find((f) => f.label === 'Royal Assent')?.value
  const { prefix: idPrefix, number: idNum } = splitBillId(billId)
  const dates = kind === 'law' ? [] : facts.filter((f) => f.label !== 'Introduced')
  return (
    <li className={styles.card} data-kind={kind}>
      <div className={styles.head}>
        <span className={styles.idTile} aria-hidden="true">
          {idPrefix && <span className={styles.idPrefix}>{idPrefix}</span>}
          <span className={styles.idMain}>{idNum}</span>
          {billType && <span className={styles.idType}>{billType.replace(/ Bill$/, '')}</span>}
        </span>
        <div className={styles.headMain}>
          <span className={styles.idLine}>{idPrefix ?? 'Bill'} {idNum}{billType ? ` · ${billType.replace(/ Bill$/, '')}` : ''}</span>
          <Link href={href} className={styles.title}><span className={styles.titleText}>{title}</span></Link>
          {lines.length > 0 && (
            <span className={styles.lines}>
              {lines.map((line) => <span key={line}>{line}</span>)}
            </span>
          )}
          <span className={styles.tags}>
            {accelerated && (
              <span className={styles.tag} data-tone="warm">
                <Zap size={14} strokeWidth={2.25} aria-hidden="true" />
                Accelerated
              </span>
            )}
            {dates.map((f) => (
              <span key={f.label} className={styles.tag} data-tone={kind === 'scheduled' ? 'solid' : undefined}>
                <CalendarDays size={14} strokeWidth={2.25} aria-hidden="true" />
                {f.label} {f.value}
              </span>
            ))}
          </span>
        </div>
        <ArrowRight className={styles.arrow} size={18} strokeWidth={2} aria-hidden="true" />
      </div>

      {kind === 'law' ? (
        <div className={styles.enacted}>
          <span className={styles.enactedLabel}>
            <CheckCircle2 size={18} strokeWidth={2.25} aria-hidden="true" />
            Became law
          </span>
          {enactedDate && (
            <span className={styles.enactedDate}>
              <span className={styles.enactedCaption}>Royal Assent</span>
              {enactedDate}
            </span>
          )}
        </div>
      ) : (
        <Rail progress={progress} kind={kind} />
      )}

    </li>
  )
}
