import type { BillKind } from '@/components/bills/BillCard'

interface StatusInput {
  royal_assent_date: string | null
  latest_date: string
  final_stage_outcome: string | null
  final_stage_hansard_outcome: string | null
}

export function billStatus(b: StatusInput): { kind: BillKind; passed: boolean | null } {
  const today = new Date().toISOString().slice(0, 10)
  const latest = new Date(b.latest_date).toISOString().slice(0, 10)
  const recorded = b.final_stage_outcome
  const finalPassed = recorded ? /carried/i.test(recorded) : b.final_stage_hansard_outcome === 'passed'
  const finalFailed = recorded ? /negatived|fell/i.test(recorded) : b.final_stage_hansard_outcome === 'negatived'

  if (b.royal_assent_date != null) return { kind: 'law', passed: true }
  if (finalPassed) return { kind: 'awaiting', passed: true }
  if (finalFailed) return { kind: 'failed', passed: false }
  return { kind: latest >= today ? 'scheduled' : 'active', passed: null }
}
