import { isPassed } from '@/lib/bills'
import type { BillStageRow, BillCommitteeRow, BillTablerRow } from '@/lib/db/queries'

const MONTH_INDEX: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

export const PROCEDURAL_EVENT_TYPES = [
  'extension',
  'accelerated_passage',
  'closure_of_debate',
  'ad_hoc_committee',
  'standing_order_suspension',
] as const

export function isProceduralEvent(eventType: string): boolean {
  return (PROCEDURAL_EVENT_TYPES as readonly string[]).includes(eventType)
}

export function eventLabel(row: BillStageRow): string {
  switch (row.event_type) {
    case 'extension': return 'Extension of Committee Stage'
    case 'accelerated_passage': return 'Accelerated passage'
    case 'ad_hoc_committee': return 'Ad hoc committee established'
    case 'closure_of_debate': {
      const stage = row.stage.replace(/^closure of debate\s*-\s*/i, '').trim()
      return stage && stage.toLowerCase() !== row.stage.toLowerCase() ? `Closure of debate (${stage})` : 'Closure of debate'
    }
    case 'standing_order_suspension': {
      const head = (row.raw_title ?? row.stage).split(/\s+[-–—]\s+/)[0].trim()
      return head || row.stage
    }
    default: return row.stage
  }
}

export function parseExtensionDeadline(text: string | null): string | null {
  if (!text) return null
  const m = text.match(/extended to (\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i)
  if (!m) return null
  const month = MONTH_INDEX[m[2].toLowerCase()]
  if (month === undefined) return null
  const d = new Date(Date.UTC(Number(m[3]), month, Number(m[1])))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export function committeeItemTitle(row: BillCommitteeRow): string {
  const t = row.item_title.trim()
  const b = row.bill_title.trim()
  if (b && t.toLowerCase().startsWith(b.toLowerCase())) {
    const rest = t.slice(b.length).replace(/^\s*[-–—:]\s*/, '').trim()
    if (rest) return rest
  }
  return t
}

export interface Signatory {
  personId: string
  name: string
  party: string | null
}

export interface PetitionAmendment {
  documentId: string
  number: number | null
  label: string
  stageLabel: string | null
  date: string
}

export interface PetitionGroup {
  key: string
  signatories: Signatory[]
  parties: { party: string; count: number }[]
  amendments: PetitionAmendment[]
}

export function buildPetitions(stages: BillStageRow[], tablers: BillTablerRow[]): PetitionGroup[] {
  const petitions = stages.filter(s => s.event_type === 'petition_of_concern')
  if (petitions.length === 0) return []

  const tablersByDoc = new Map<string, BillTablerRow[]>()
  for (const t of tablers) {
    const list = tablersByDoc.get(t.document_id) ?? []
    list.push(t)
    tablersByDoc.set(t.document_id, list)
  }

  const groups = new Map<string, PetitionGroup>()

  for (const p of petitions) {
    const signatories: Signatory[] = (tablersByDoc.get(p.document_id) ?? [])
      .filter(t => t.person_id)
      .map(t => ({ personId: t.person_id as string, name: t.tabler_name, party: t.party }))
      .sort((a, b) => a.name.localeCompare(b.name))
    const key = signatories.map(s => s.personId).join('|') || `none-${p.document_id}`

    const parsed = (p.raw_title ?? '').match(/Amendment\s+(\d+)\s*-\s*([A-Za-z ]+Stage)/i)
    const number = parsed ? Number(parsed[1]) : null
    const stageLabel = parsed ? parsed[2].trim() : null
    const label = number !== null
      ? `Amendment ${number}`
      : (p.raw_title ?? p.stage).replace(/^petition of concern\s*:\s*/i, '').replace(/\s*\(NIA[^)]*\)?.*$/i, '').trim()

    const group = groups.get(key) ?? { key, signatories, parties: [], amendments: [] }
    group.amendments.push({ documentId: p.document_id, number, label, stageLabel, date: p.plenary_date })
    groups.set(key, group)
  }

  const result = [...groups.values()]
  for (const g of result) {
    g.amendments.sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    const counts = new Map<string, number>()
    for (const s of g.signatories) counts.set(s.party ?? 'Unknown', (counts.get(s.party ?? 'Unknown') ?? 0) + 1)
    g.parties = [...counts.entries()].map(([party, count]) => ({ party, count })).sort((a, b) => b.count - a.count || a.party.localeCompare(b.party))
  }
  result.sort((a, b) => b.signatories.length - a.signatories.length)
  return result
}

export interface CommitteeSummary {
  committees: string[]
  meetingCount: number
  firstMeeting: string | null
  lastMeeting: string | null
  nextMeeting: string | null
  extensionCount: number
  currentDeadline: string | null
  defeatedExtension: { date: string; deadline: string | null } | null
}

export function buildCommitteeSummary(items: BillCommitteeRow[], stages: BillStageRow[], today: string): CommitteeSummary | null {
  const allExtensions = stages
    .filter(s => s.event_type === 'extension')
    .sort((a, b) => a.plenary_date.localeCompare(b.plenary_date))
  const extensions = allExtensions.filter(s => isPassed(s.outcome ?? s.decision_outcome) !== false)
  const latestExtension = allExtensions[allExtensions.length - 1] ?? null
  const defeatedExtension = latestExtension && isPassed(latestExtension.outcome ?? latestExtension.decision_outcome) === false
    ? { date: latestExtension.plenary_date.slice(0, 10), deadline: parseExtensionDeadline(latestExtension.item_text) }
    : null
  if (items.length === 0 && allExtensions.length === 0) return null

  const counts = new Map<string, number>()
  for (const i of items) counts.set(i.committee_name.trim(), (counts.get(i.committee_name.trim()) ?? 0) + 1)
  const dates = [...new Set(items.map(i => i.meeting_date))].sort()
  const past = dates.filter(d => d <= today)
  const future = dates.filter(d => d > today)

  let currentDeadline: string | null = null
  for (const e of extensions) {
    const d = parseExtensionDeadline(e.item_text)
    if (d) currentDeadline = d
  }

  return {
    committees: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name),
    meetingCount: new Set(items.map(i => i.event_id)).size,
    firstMeeting: dates[0] ?? null,
    lastMeeting: past[past.length - 1] ?? null,
    nextMeeting: future[0] ?? null,
    extensionCount: extensions.length,
    currentDeadline,
    defeatedExtension,
  }
}

export function findSponsors(stages: BillStageRow[], tablers: BillTablerRow[]): BillTablerRow[] {
  const second = stages
    .filter(s => s.event_type === 'stage' && s.stage.toLowerCase() === 'second stage' && !s.item_title)
    .sort((a, b) => a.plenary_date.localeCompare(b.plenary_date))
  for (const row of second) {
    const found = tablers.filter(t => t.document_id === row.document_id)
    if (found.length > 0) return found
  }
  return []
}

export function groupTablersByDocument(tablers: BillTablerRow[]): Record<string, BillTablerRow[]> {
  const out: Record<string, BillTablerRow[]> = {}
  for (const t of tablers) (out[t.document_id] ??= []).push(t)
  return out
}
