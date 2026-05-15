export type BillEventType = 'voted' | 'passed'

export interface BillEvent {
  stage: string
  plenaryDate: string
  eventType: BillEventType
  outcome: string | null
}

export interface BillProgressedThisWeek {
  billId: string
  shortTitle: string
  billType: string | null
  mandate: string
  royalAssentDate: string | null
  events: BillEvent[]
  fullHistory: { stage: string; plenaryDate: string; hasDivision: boolean }[]
  headlineEvent: BillEvent
  isAccelerated: boolean
}

const PROCEDURAL = [
  'Accelerated Passage',
  'Suspension of Standing Order 39',
  'Extension of Committee Stage',
]

const PRECEDENCE: Record<BillEventType, number> = { voted: 2, passed: 1 }

export function deriveHeadlineEvent(events: BillEvent[]): BillEvent {
  if (events.length === 0) throw new Error('deriveHeadlineEvent called with empty array')
  return events.reduce((best, e) => {
    const bp = PRECEDENCE[best.eventType]
    const ep = PRECEDENCE[e.eventType]
    if (ep > bp) return e
    if (ep === bp && e.plenaryDate > best.plenaryDate) return e
    return best
  })
}

export function getPillInfo(bill: BillProgressedThisWeek): { label: string; cls: string } {
  if (bill.royalAssentDate) return { label: 'Became law', cls: 'pass' }
  const e = bill.headlineEvent
  if (e.eventType === 'voted') {
    if (/carried|agreed/i.test(e.outcome ?? '')) return { label: 'Passed by vote', cls: 'pass' }
    if (/negatived|fell/i.test(e.outcome ?? '')) return { label: 'Failed by vote', cls: 'fail' }
    return { label: 'Voted', cls: 'neutral' }
  }
  return { label: 'Heard', cls: 'neutral' }
}

export function formatEventLine(event: BillEvent): string {
  const dateStr = new Date(event.plenaryDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  let action: string
  if (event.eventType === 'passed') {
    action = 'heard'
  } else if (/carried|agreed/i.test(event.outcome ?? '')) {
    action = 'passed by vote'
  } else if (/negatived|fell/i.test(event.outcome ?? '')) {
    action = 'failed by vote'
  } else {
    action = 'voted'
  }
  return `${event.stage} ${action} · ${dateStr}`
}

export function groupProgressedBills(data: {
  weekEvents: {
    bill_id: string; short_title: string; bill_type: string | null; is_accelerated: boolean
    royal_assent_date: string | null; mandate: string; stage: string; plenary_date: string
    has_division: boolean; outcome: string | null; event_type: BillEventType
  }[]
  fullHistory: { bill_id: string; stage: string; plenary_date: string; has_division: boolean }[]
}): BillProgressedThisWeek[] {
  const billMap = new Map<string, BillProgressedThisWeek>()

  for (const row of data.weekEvents) {
    if (!billMap.has(row.bill_id)) {
      billMap.set(row.bill_id, {
        billId: row.bill_id,
        shortTitle: row.short_title,
        billType: row.bill_type,
        mandate: row.mandate,
        royalAssentDate: row.royal_assent_date,
        events: [],
        fullHistory: [],
        headlineEvent: { stage: row.stage, plenaryDate: row.plenary_date, eventType: row.event_type, outcome: row.outcome },
        isAccelerated: row.is_accelerated,
      })
    }
    billMap.get(row.bill_id)!.events.push({
      stage: row.stage,
      plenaryDate: row.plenary_date,
      eventType: row.event_type,
      outcome: row.outcome,
    })
  }

  for (const row of data.fullHistory) {
    billMap.get(row.bill_id)?.fullHistory.push({
      stage: row.stage,
      plenaryDate: row.plenary_date,
      hasDivision: row.has_division,
    })
  }

  for (const bill of billMap.values()) {
    bill.headlineEvent = deriveHeadlineEvent(bill.events)
    // Preserve the flag from the bills table; also check fullHistory for procedural stage rows
    bill.isAccelerated = bill.isAccelerated || bill.fullHistory.some(r =>
      PROCEDURAL.some(p => p.toLowerCase() === r.stage.toLowerCase())
    )
  }

  return [...billMap.values()]
}
