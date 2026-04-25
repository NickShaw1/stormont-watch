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

/**
 * Parse a bill number slug from an API title string.
 * Expected format: "NIA Bill XX/XX-XX" somewhere in the title.
 * Returns slug like "nia-bill-01-22-27" or null.
 */
export function parseBillSlug(title: string | null | undefined): string | null {
  if (!title) return null
  const match = title.match(/NIA\s+Bill\s+([\d]+)\/([\d]+-[\d]+)/i)
  if (!match) return null
  const [, billNum, session] = match
  return `nia-bill-${billNum.padStart(2, '0')}-${session.replace('/', '-')}`
}

/**
 * Parse a bill number (e.g. "01/22-27") from a title for grouping.
 */
export function parseBillNumber(title: string | null | undefined): string | null {
  if (!title) return null
  const match = title.match(/NIA\s+Bill\s+([\d]+\/[\d]+-[\d]+)/i)
  return match ? match[1] : null
}

/**
 * Parse the human-readable bill name from a division subject.
 * E.g. "Second Stage: School Uniforms (Guidelines and Allowances) Bill (NIA Bill 12/22-27) [...]"
 * → "School Uniforms (Guidelines and Allowances) Bill"
 */
export function parseBillTitle(subject: string | null | undefined): string | null {
  if (!subject) return null
  const match = subject.match(/:\s*(.+?)\s*\(NIA Bill/i)
  return match ? match[1].trim() : null
}

/**
 * Parse the stage name from a division title.
 * E.g. "NIA Bill 01/22-27 — Second Stage" → "Second Stage"
 * Falls back to the full title.
 */
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
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/**
 * Sort key for grouping by month (descending).
 */
export function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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

/**
 * Format a party name for display.
 * Pass abbreviated=true in tight-space contexts (cards, pills, roll call).
 * Without the flag, returns the full party name as-is.
 */
export function formatPartyName(party: string | null | undefined, abbreviated = false): string {
  if (!party) return ''
  if (!abbreviated) return party
  return abbreviateParty(party)
}

// Keyed by abbreviated name (must match what abbreviateParty() returns)
const PARTY_COLORS: Record<string, { bg: string; color: string; border: string; countBg: string }> = {
  'Sinn Féin': { bg: '#D5ECEA', color: '#1E4E49', border: '#5AA39C', countBg: 'rgba(50,103,96,0.18)' },
  'DUP':      { bg: '#FDEAEA', color: '#7B0D1E', border: '#F4A0A8', countBg: 'rgba(196,30,58,0.12)' },
  'Alliance': { bg: '#FEF3C7', color: '#78350F', border: '#FDE68A', countBg: 'rgba(120,53,15,0.12)' },
  'UUP':      { bg: '#DBEAFE', color: '#1E3A8A', border: '#93C5FD', countBg: 'rgba(30,58,138,0.12)' },
  'SDLP':     { bg: '#C8F0D4', color: '#14532D', border: '#22863A', countBg: 'rgba(20,83,45,0.20)' },
  'TUV':      { bg: '#E0E7FF', color: '#1E1B4B', border: '#A5B4FC', countBg: 'rgba(30,27,75,0.12)' },
  'PBP':      { bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5', countBg: 'rgba(153,27,27,0.12)' },
  'Ind':      { bg: '#F3F4F6', color: '#374151', border: '#9CA3AF', countBg: 'rgba(55,65,81,0.12)' },
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

export function partyPillStyle(party: string | null | undefined): { background: string; color: string; border: string } {
  const abbr = abbreviateParty(party)
  const colors = PARTY_COLORS[abbr]
  if (!colors) return { background: '#E2E3E5', color: '#383D41', border: '1px solid #C6C8CA' }
  return { background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }
}

export function partyFilterActiveStyle(party: string | null | undefined): { background: string; color: string; borderColor: string; countBg: string; countColor: string } | null {
  const c = partyBorderColor(party)
  if (!c) return null
  return {
    background: 'transparent',
    color: c,
    borderColor: c,
    countBg: 'transparent',
    countColor: c,
  }
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

/**
 * Strip leading title prefix from an MLA's full display name.
 * e.g. "Mr John Smith OBE" → "John Smith OBE"
 */
export function formatMemberName(fullName: string): string {
  return fullName
    .replace(/^(Mr|Mrs|Miss|Ms|Dr|Lord|Lady|Sir)\s+/i, '')
    .trim()
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

export function stripPreamble(text: string): string {
  const stripped = text.replace(
    /^To ask the (?:First Minister and deputy First Minister|First Minister|deputy First Minister|Minister (?:of|for)(?: the)? [A-Za-z,& ]+?)\s+/i,
    ''
  ).trim()
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}
