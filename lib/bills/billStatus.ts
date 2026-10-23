import type { BillKind } from '@/components/bills/BillCard'

interface StatusInput {
  royal_assent_date: string | null
  display_stage: string
  latest_date: string
  final_stage_has_division: boolean | null
  final_stage_outcome: string | null
  final_stage_nodiv_date: string | null
}

export function billStatus(b: StatusInput): { kind: BillKind; passed: boolean | null } {
  const today = new Date().toISOString().slice(0, 10)
  const latest = new Date(b.latest_date).toISOString().slice(0, 10)
  const finalPassed = b.final_stage_has_division === true && /carried/i.test(b.final_stage_outcome ?? '')
  const finalFailed = b.final_stage_has_division === true && /negatived|fell/i.test(b.final_stage_outcome ?? '')
  const completed =
    b.royal_assent_date != null ||
    (b.display_stage.toLowerCase() === 'final stage' && latest < today) ||
    finalPassed ||
    finalFailed

  if (!completed) return { kind: latest >= today ? 'scheduled' : 'active', passed: null }

  const passed = b.royal_assent_date != null ? true
    : finalPassed ? true
    : finalFailed ? false
    : b.final_stage_nodiv_date && new Date(b.final_stage_nodiv_date) < new Date() ? true
    : null

  if (b.royal_assent_date != null) return { kind: 'law', passed }
  return { kind: passed === false ? 'failed' : 'awaiting', passed }
}
