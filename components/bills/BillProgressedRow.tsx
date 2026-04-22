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

export default function BillProgressedRow({ bill }: { bill: BillProgressedThisWeek }) {
  const { main, session } = formatBillNum(bill.billId)
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
        <strong className={styles.numMain}>{main}</strong>
        {session && <div className={styles.numSession}>{session}</div>}
        {bill.billType && <div className={styles.numType}>{bill.billType}</div>}
      </div>

      <div className={styles.center}>
        <div className={styles.title}>{bill.shortTitle}</div>

        {proceduralFlags.length > 0 && (
          <div className={styles.proceduralBadges}>
            {proceduralFlags.map(p => (
              <span key={p} className={`pill accent ${styles.proceduralBadge}`}>
                {p === 'Accelerated Passage' ? 'Accelerated' : p}
              </span>
            ))}
          </div>
        )}

        <div className={styles.eventList}>
          {bill.events.map((e, i) => (
            <div key={i} className={styles.eventLine}>{formatEventLine(e)}</div>
          ))}
        </div>

        <div className={styles.progressBar}>
          {BILL_STAGES.map((s, i) => {
            const completedUpTo = scheduledIdx !== null ? scheduledIdx - 1 : stageIdx
            return (
              <div
                key={s}
                className={styles.progressSeg}
                style={{
                  background:
                    i <= completedUpTo ? 'var(--forest)' :
                    i === scheduledIdx ? 'var(--teal)' :
                    'transparent',
                }}
              />
            )
          })}
        </div>
        <div className={styles.progressLabels}>
          <span>INTRO</span>
          <span>ROYAL ASSENT</span>
        </div>
      </div>

      <div className={styles.right}>
        <span className={`pill ${pillCls}`}>{pillLabel}</span>
        <div className={styles.pct}>{percent}% complete</div>
      </div>
    </Link>
  )
}
