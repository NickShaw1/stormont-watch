import { abbreviateParty, displayParty, formatMemberName } from '@/lib/format'
import type { CompareMla } from '@/lib/db/queries/compare'

export const SEARCH_MAX = 25

export const cleanQuery = (v: string) => v.replace(/[^\p{L}\s'’-]/gu, '').replace(/^\s+/, '').replace(/\s{2,}/g, ' ').slice(0, SEARCH_MAX)

export function filterMlas(mlas: CompareMla[], query: string, otherId: string | null): CompareMla[] {
  const q = query.trim().toLowerCase()
  return mlas.filter((m) => m.id !== otherId && (!q
    || formatMemberName(m.name).toLowerCase().includes(q)
    || (m.constituency ?? '').toLowerCase().includes(q)
    || partyTerms(m.party).some((term) => term.includes(q))))
}

function partyTerms(party: string | null): string[] {
  const shown = displayParty(party)
  const short = abbreviateParty(party)
  const terms = [shown, short]
  if (party && shown === short) terms.push(party)
  return terms.map((t) => t.toLowerCase())
}
