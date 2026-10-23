import type { BillProgressedThisWeek } from '@/lib/bills/progressedThisWeekProgress'
import { getPillInfo, formatEventLine } from '@/lib/bills/progressedThisWeekProgress'
import { computeBillProgress } from '@/lib/bills/billProgress'
import { formatDate } from '@/lib/format'
import BillCard from './BillCard'

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

export default function BillProgressedRow({ bill, basePath }: { bill: BillProgressedThisWeek; basePath: string }) {
  const { stageIdx, scheduledIdx, proceduralFlags } = computeBillProgress(
    bill.fullHistory.map(r => ({ stage: r.stage, plenaryDate: r.plenaryDate })),
    bill.royalAssentDate,
    false,
  )
  const { label } = getPillInfo(bill)
  const events = bill.events.map((e) => {
    const isHeadline = e.stage === bill.headlineEvent.stage
      && e.plenaryDate === bill.headlineEvent.plenaryDate
      && e.eventType === bill.headlineEvent.eventType
    return formatEventLine(e, isHeadline)
  })
  const otherFlags = proceduralFlags.filter((p) => p !== 'Accelerated Passage')
  const dates = bill.fullHistory.map(r => r.plenaryDate).filter(d => !isNaN(new Date(d).getTime())).sort()

  return (
    <BillCard
      href={`${basePath}/assembly/bills/${billSlug(bill.billId)}`}
      billId={bill.billId}
      billType={bill.billType}
      title={bill.shortTitle}
      kind={bill.royalAssentDate ? 'law' : 'active'}
      accelerated={proceduralFlags.includes('Accelerated Passage')}
      lines={[label, ...events, ...otherFlags]}
      facts={[
        ...(dates[0] ? [{ label: 'Introduced', value: formatDate(dates[0]) }] : []),
        ...(bill.royalAssentDate ? [{ label: 'Royal Assent', value: formatDate(bill.royalAssentDate) }] : []),
      ]}
      progress={{ stageIdx, scheduledIdx }}
    />
  )
}
