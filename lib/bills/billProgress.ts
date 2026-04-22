export const BILL_STAGES = [
  'Introduction',
  'First Stage',
  'Second Stage',
  'Committee Stage',
  'Consideration Stage',
  'Further Consideration Stage',
  'Final Stage',
  'Royal Assent',
] as const

export type BillStageName = typeof BILL_STAGES[number]

export const PROCEDURAL_STAGES = [
  'Accelerated Passage',
  'Suspension of Standing Order 39',
  'Extension of Committee Stage',
] as const

export interface BillProgress {
  stageIdx: number
  scheduledIdx: number | null
  currentStageLabel: string
  percent: number
  proceduralFlags: string[]
  unmatchedStages: string[]
}

const BILL_STAGES_LOWER = BILL_STAGES.map(s => s.toLowerCase())
const PROCEDURAL_LOWER = PROCEDURAL_STAGES.map(s => s.toLowerCase())

export function computeBillProgress(
  stageHistory: { stage: string; plenaryDate: string | Date }[],
  royalAssentDate: string | Date | null,
  billPassed?: boolean,
): BillProgress {
  if (royalAssentDate) {
    const d = new Date(royalAssentDate)
    if (!isNaN(d.getTime()) && d <= new Date()) {
      return {
        stageIdx: BILL_STAGES.length - 1,
        scheduledIdx: null,
        currentStageLabel: 'Royal Assent',
        percent: 100,
        proceduralFlags: [],
        unmatchedStages: [],
      }
    }
  }

  const now = new Date()
  let stageIdx = -1
  const proceduralFlags: string[] = []
  const unmatchedStages: string[] = []
  let scheduledIdx: number | null = null

  for (const row of stageHistory) {
    const plenaryDate = new Date(row.plenaryDate)
    if (isNaN(plenaryDate.getTime())) continue

    const stageLower = row.stage.toLowerCase()

    if (plenaryDate > now) {
      const ladderIdx = BILL_STAGES_LOWER.indexOf(stageLower)
      if (ladderIdx !== -1 && ladderIdx > stageIdx) {
        if (scheduledIdx === null || ladderIdx < scheduledIdx) {
          scheduledIdx = ladderIdx
        }
      }
      continue
    }

    const procIdx = PROCEDURAL_LOWER.indexOf(stageLower)
    if (procIdx !== -1) {
      const flag = PROCEDURAL_STAGES[procIdx]
      if (!proceduralFlags.includes(flag)) proceduralFlags.push(flag)
      continue
    }

    const ladderIdx = BILL_STAGES_LOWER.indexOf(stageLower)
    if (ladderIdx === -1) {
      if (!unmatchedStages.includes(row.stage)) {
        unmatchedStages.push(row.stage)
        console.warn(`[computeBillProgress] Unmatched stage: "${row.stage}"`)
      }
      continue
    }

    if (ladderIdx > stageIdx) stageIdx = ladderIdx
  }

  if (billPassed === true && !royalAssentDate) {
    scheduledIdx = BILL_STAGES.length - 1
  }

  return {
    stageIdx,
    scheduledIdx,
    currentStageLabel: stageIdx < 0 ? '' : BILL_STAGES[stageIdx],
    percent: stageIdx < 0 ? 0 : Math.round((stageIdx / (BILL_STAGES.length - 1)) * 100),
    proceduralFlags,
    unmatchedStages,
  }
}
