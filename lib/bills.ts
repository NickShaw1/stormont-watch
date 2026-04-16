import { parseBillNumber, parseBillSlug, parseBillTitle } from './format'
import type { DivisionListItem } from './assembly-api'

export interface BillGroup {
  slug: string
  billNumber: string
  title: string
  divisions: DivisionListItem[]
  latestDate: string
  latestOutcome: string | null
}

export interface StandaloneMotion {
  division: DivisionListItem
}

/**
 * Group divisions by bill number. Divisions with no bill number are returned
 * as standalone motions.
 */
export function groupDivisionsByBill(divisions: DivisionListItem[]): {
  bills: BillGroup[]
  standalone: StandaloneMotion[]
} {
  const billMap = new Map<string, DivisionListItem[]>()
  const standalone: StandaloneMotion[] = []

  for (const div of divisions) {
    const billNum = parseBillNumber(div.DivisionSubject)
    if (billNum) {
      const existing = billMap.get(billNum) ?? []
      existing.push(div)
      billMap.set(billNum, existing)
    } else {
      standalone.push({ division: div })
    }
  }

  const bills: BillGroup[] = []
  for (const [billNum, divs] of Array.from(billMap.entries())) {
    const sorted = divs.slice().sort((a, b) => a.DivisionDate.localeCompare(b.DivisionDate))
    const latest = sorted[sorted.length - 1]
    const slug = parseBillSlug(latest.DivisionSubject) ?? billNum.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    // Prefer a stage-named division for title extraction over an amendment
    const titleDiv = sorted.find(d =>
      /^(Second Stage|Final Stage|Committee Stage|Consideration Stage)/i.test(d.DivisionSubject)
    ) ?? sorted[0]
    const title = parseBillTitle(titleDiv.DivisionSubject) ?? titleDiv.DivisionSubject

    bills.push({
      slug,
      billNumber: billNum,
      title,
      divisions: sorted,
      latestDate: latest.DivisionDate,
      latestOutcome: null, // populated separately when needed
    })
  }

  // Sort bills most recent first
  bills.sort((a, b) => b.latestDate.localeCompare(a.latestDate))

  return { bills, standalone }
}

/**
 * Determine whether a division passed based on the Outcome field.
 * The API returns free-text outcomes; we look for common patterns.
 */
export function isPassed(outcome: string | null | undefined): boolean | null {
  if (!outcome) return null
  const lower = outcome.toLowerCase()
  if (lower.includes('carried') || lower.includes('passed') || lower.includes('agreed')) return true
  if (
    lower.includes('failed') ||
    lower.includes('rejected') ||
    lower.includes('not carried') ||
    lower.includes('negatived') ||
    lower.includes('fell')
  ) return false
  return null
}
