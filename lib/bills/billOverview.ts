import type { getAllBills } from '@/lib/db/queries'
import { billStatus } from './billStatus'
import { computeBillProgress } from './billProgress'
import { PIPELINE_LABELS, pipelineIndex } from './billStats'

type BillRow = Awaited<ReturnType<typeof getAllBills>>[number]

export interface ActiveBill {
  billId: string
  shortTitle: string
  billType: string | null
  latestDate: string
  stageLabel: string
}

export function homeBillOverview(rows: BillRow[], limit: number): { pendingCount: number; active: ActiveBill[] } {
  const classified = rows.map(b => ({ b, ...billStatus(b) }))
  const pendingCount = classified.filter(c => c.kind === 'scheduled' || c.kind === 'active').length
  const active = classified
    .filter(c => c.kind === 'active')
    .sort((x, y) => new Date(y.b.latest_date).getTime() - new Date(x.b.latest_date).getTime())
    .slice(0, limit)
    .map(({ b, passed }) => {
      const { stageIdx } = computeBillProgress(b.stage_history, b.royal_assent_date, passed === true, { isAccelerated: b.is_accelerated })
      return {
        billId: b.bill_id,
        shortTitle: b.short_title,
        billType: b.bill_type,
        latestDate: b.latest_date,
        stageLabel: PIPELINE_LABELS[pipelineIndex(stageIdx)] as string,
      }
    })
  return { pendingCount, active }
}
