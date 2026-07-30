import Link from 'next/link'
import type { BillProgressedThisWeek } from '@/lib/bills/progressedThisWeekProgress'
import { getPillInfo, formatEventLine } from '@/lib/bills/progressedThisWeekProgress'
import { computeBillProgress, BILL_STAGES } from '@/lib/bills/billProgress'
import styles from './billProgressedRow.module.css'

function formatBillNum(billId: string): { main: string; session: string } {
  const idx = billId.lastIndexOf('/')
  if (idx === -1) return { main: billId, session: '' }
  return { main: billId.slice(0, idx), session: billId.slice(idx + 1) }
}

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  pass: styles.statusBadgePassed,
  fail: styles.statusBadgeError,
  neutral: styles.statusBadgeNeutral,
}

// getPillInfo's 'pass' class covers both "Became law" and "Passed by vote".
function statusBadgeClassFor(bill: BillProgressedThisWeek, cls: string): string {
  if (bill.royalAssentDate) return styles.statusBadgeBecameLaw
  return STATUS_BADGE_CLASS[cls] ?? styles.statusBadgeNeutral
}

// BILL_STAGES minus "Introduction" — that's not a numbered stage.
const NUMBERED_STAGES = BILL_STAGES.slice(1)

export default function BillProgressedRow({ bill }: { bill: BillProgressedThisWeek }) {
  const { main, session } = formatBillNum(bill.billId)
  // billPassed is false: scheduled segments come from future-dated fullHistory rows, not inference.
  const { stageIdx, scheduledIdx, percent, proceduralFlags } = computeBillProgress(
    bill.fullHistory.map(r => ({ stage: r.stage, plenaryDate: r.plenaryDate })),
    bill.royalAssentDate,
    false,
  )
  const { label: pillLabel, cls: pillCls } = getPillInfo(bill)
  const slug = billSlug(bill.billId)

  return (
    <Link href={`/assembly/bills/${slug}`} className={styles.row}>
      <div className={styles.numCol}>
        <span className={styles.numMain}>{main}</span>
        {session && <span className={styles.numSession}>{session}</span>}
        {bill.billType && <span className={styles.numType}>{bill.billType}</span>}
      </div>

      <div className={styles.center}>
        <div className={styles.titleRow}>
          <div className={styles.title}>{bill.shortTitle}</div>
          <div className={styles.badgeRow}>
            <span className={`${styles.statusBadge} ${statusBadgeClassFor(bill, pillCls)}`}>{pillLabel}</span>
          </div>
        </div>

        {proceduralFlags.length > 0 && (
          <div className={styles.proceduralBadges}>
            {proceduralFlags.map(p => (
              <span key={p} className={styles.proceduralBadge}>
                {p === 'Accelerated Passage' ? 'Accelerated' : p}
              </span>
            ))}
          </div>
        )}

        <div className={styles.eventList}>
          {bill.events.map((e, i) => {
            const isHeadline = e.stage === bill.headlineEvent.stage
              && e.plenaryDate === bill.headlineEvent.plenaryDate
              && e.eventType === bill.headlineEvent.eventType
            return <div key={i} className={styles.eventLine}>{formatEventLine(e, isHeadline)}</div>
          })}
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressLabels}>
            <span className={styles.progressStageCount}>Stage {Math.max(stageIdx, 0)} of {BILL_STAGES.length - 1}</span>
            <span className={styles.progressPct}>{percent}%</span>
          </div>
          <div className={styles.progressBar}>
            {NUMBERED_STAGES.map((s, j) => {
              const i = j + 1 // offset for the dropped "Introduction" index
              const completedUpTo = scheduledIdx !== null ? scheduledIdx - 1 : stageIdx
              const state = i <= completedUpTo ? 'done' : i === scheduledIdx ? 'scheduled' : undefined
              return <div key={s} className={styles.progressSeg} data-state={state} title={s} />
            })}
          </div>
        </div>
      </div>
    </Link>
  )
}
