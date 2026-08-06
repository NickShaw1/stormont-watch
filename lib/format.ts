// Whole-pound GBP, rounded: 1234.56 -> "£1,235".
export function gbp(val: number): string {
  return `£${Math.round(val).toLocaleString('en-GB')}`
}

/**
 * Format an ISO date string or date-like value to "1 January 2024" (British English).
 */
export function formatDate(raw: string | null | undefined): string {
  if (!raw) return ''
  const [year, month, day] = raw.slice(0, 10).split('-')
  if (!year || !month || !day) return ''
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`
}

// Parses "NIA Bill XX/XX-XX" into a slug like "nia-bill-01-22-27".
export function parseBillSlug(title: string | null | undefined): string | null {
  if (!title) return null
  const match = title.match(/NIA\s+Bill\s+([\d]+)\/([\d]+-[\d]+)/i)
  if (!match) return null
  const [, billNum, session] = match
  return `nia-bill-${billNum.padStart(2, '0')}-${session.replace('/', '-')}`
}

// E.g. "NIA Bill 01/22-27 — Second Stage" -> "Second Stage". Falls back to the title.
export function parseStageName(title: string | null | undefined): string {
  if (!title) return 'Unknown stage'
  const dashMatch = title.match(/[—–-]\s*(.+)$/)
  if (dashMatch) return dashMatch[1].trim()
  return title
}

/**
 * Format a month header: "January 2024"
 */
export function formatMonthGroup(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Sort key for grouping by month (descending).
 */
export function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const PARTY_ABBREVIATIONS: Record<string, string> = {
  'Social Democratic and Labour Party': 'SDLP',
  'Democratic Unionist Party': 'DUP',
  'Ulster Unionist Party': 'UUP',
  'Alliance Party': 'Alliance',
  'Sinn Féin': 'Sinn Féin',
  'Traditional Unionist Voice': 'TUV',
  'People Before Profit Alliance': 'PBP',
  'Ulster Political Research Group': 'UPRG',
  'Independent': 'Ind',
}

export function abbreviateParty(party: string | null | undefined): string {
  if (!party) return ''
  return PARTY_ABBREVIATIONS[party] ?? party
}

// Pass abbreviated=true for tight spaces like cards, pills, roll call.
export function formatPartyName(party: string | null | undefined, abbreviated = false): string {
  if (!party) return ''
  if (!abbreviated) return party
  return abbreviateParty(party)
}

const PARTY_SOLID_COLORS: Record<string, { bg: string; color: string }> = {
  'Sinn Féin':                      { bg: '#326760', color: 'white' },
  'DUP':                            { bg: '#C41E3A', color: 'white' },
  'Alliance':                       { bg: '#F6C135', color: '#1a1a1a' },
  'UUP':                            { bg: '#5B8DD9', color: 'white' },
  'SDLP':                           { bg: '#2E8B57', color: 'white' },
  'TUV':                            { bg: '#1a1a6e', color: 'white' },
  'PBP':                            { bg: '#c0392b', color: 'white' },
  'Ind':                            { bg: '#888',    color: 'white' },
}

export function partyPillStyleSolid(party: string | null | undefined): { background: string; color: string; border: string } {
  const abbr = abbreviateParty(party)
  const colors = PARTY_SOLID_COLORS[abbr]
  if (!colors) return { background: '#888', color: 'white', border: 'none' }
  return { background: colors.bg, color: colors.color, border: 'none' }
}

export function partyBorderColor(party: string | null | undefined): string {
  if (!party) return '#888888'

  const p = party.toLowerCase()

  if (p.includes('people before profit')) return '#c0392b'
  if (p.includes('democratic unionist') || p === 'dup') return '#C41E3A'
  if (p.includes('sinn féin') || p.includes('sinn fein')) return '#326760'
  if (p === 'alliance' || p === 'alliance party' || p.startsWith('alliance party')) return '#F6C135'
  if (p.includes('ulster unionist') || p === 'uup') return '#5B8DD9'
  if (p.includes('social democratic') || p === 'sdlp') return '#2E8B57'
  if (p.includes('traditional unionist') || p === 'tuv') return '#1a1a6e'
  if (p.includes('independent')) return '#888888'

  return '#888888'
}

// e.g. "Mr John Smith OBE" -> "John Smith OBE".
export function formatMemberName(fullName: string): string {
  const stripped = fullName
    .replace(/^(Mr|Mrs|Miss|Ms|Dr|Lord|Lady|Sir)\s+/i, '')
    .trim()

  // "Lord Elliott" strips to just "Elliott" — restore first name
  if (stripped === 'Elliott') return 'Tom Elliott'

  return stripped
}

export function getSurname(fullName: string | null | undefined): string {
  if (!fullName) return ''
  const display = formatMemberName(fullName)
  const parts = display.trim().split(' ')
  return parts[parts.length - 1]
}

const ROLE_TITLE_DISPLAY: Record<string, string> = {
  'first minister': 'First Minister',
  'deputy first minister': 'Deputy First Minister',
  'junior minister': 'Junior Minister',
  'minister': 'Minister',
}

export function formatRoleTitle(title: string): string {
  return ROLE_TITLE_DISPLAY[title.toLowerCase().trim()] ?? title
}

/**
 * Derive initials from a full name (up to 2 characters).
 */
const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'rev'])

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(p => !TITLES.has(p.toLowerCase().replace(/\.$/, '')))
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const CONSTITUENCY_ABBREVIATIONS: Record<string, string> = {
  'Fermanagh and South Tyrone': 'Fermanagh & S. Tyrone',
  'East Londonderry': 'East Londonderry',
}

export function formatConstituency(constituency: string | null | undefined): string {
  if (!constituency) return ''
  return CONSTITUENCY_ABBREVIATIONS[constituency] ?? constituency
}

const NI_PARTY_ORDER = [
  'Democratic Unionist Party', 'Sinn Féin', 'Ulster Unionist Party', 'Alliance Party',
  'Social Democratic and Labour Party', 'Traditional Unionist Voice',
  'People Before Profit Alliance', 'Independent',
]

// Distinct parties present, in canonical NI order; unknown parties sort last.
export function orderedParties(items: { party?: string | null }[]): string[] {
  const present = [...new Set(items.map((i) => i.party).filter((p): p is string => !!p))]
  return present.sort((a, b) => {
    const ia = NI_PARTY_ORDER.indexOf(a)
    const ib = NI_PARTY_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
  })
}
