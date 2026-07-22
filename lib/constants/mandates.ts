// Single source of truth for Assembly mandates (five-year terms).
//
// Nothing consumes this yet. It is introduced ahead of the mandate refactor so that
// queries, sync scripts and UI copy can be pointed at it one at a time. Because
// CURRENT_MANDATE resolves to the same '2022-2027' value that is hard-coded today,
// routing existing code through this file is a no-op until a new term is appended.

export type Mandate = {
  /** Value stamped in every `mandate` column, e.g. "2022-2027". */
  id: string
  /** Display label, e.g. "2022–2027". */
  label: string
  /** Human label for the mandate start, for "since …" copy, e.g. "May 2022". */
  startLabel: string
  /** Date of the election that returned this Assembly. */
  electionDate: string
  /** First day of the mandate (ISO date). */
  start: string
  /** Last day of the mandate (ISO date), or null while ongoing. */
  end: string | null
  /** True if this mandate had the 2022–2024 restoration gap; drives the suspension notice. */
  hadEarlySuspension?: boolean
  /** Exactly one mandate has this true — the one the live site shows. */
  isCurrent?: boolean
}

export const MANDATES: Mandate[] = [
  {
    id: '2022-2027',
    label: '2022–2027',
    startLabel: 'May 2022',
    electionDate: '2022-05-05',
    start: '2022-05-05',
    end: null,
    hadEarlySuspension: true,
    isCurrent: true,
  },
  {
    // The next term. Present so it can be browsed as an archive; becomes `isCurrent`
    // (and 2022-2027's `end` gets set) at the boundary — that flip is the whole switch.
    id: '2027-2032',
    label: '2027–2032',
    startLabel: 'May 2027',
    electionDate: '2027-05-06',
    start: '2027-05-08',
    end: null,
    isCurrent: false,
  },
]

/** The mandate the live site shows (the one flagged current, else the latest). */
export const CURRENT_MANDATE: Mandate =
  MANDATES.find((m) => m.isCurrent) ?? MANDATES[MANDATES.length - 1]

// "Today" captured at module load. For a statically-generated site rebuilt on each
// deploy/sync this is accurate enough: a future mandate first appears at the build on or
// after its start date, and the mandate transition is a deliberate rebuild anyway.
const TODAY_ISO = new Date().toISOString().slice(0, 10)

/**
 * True once a mandate has begun (its start date is on or before today). A future mandate
 * stays hidden from user-facing navigation until then, though it remains in MANDATES so the
 * next transition is already wired up.
 */
export function mandateHasBegun(m: Mandate, todayIso: string = TODAY_ISO): boolean {
  return m.start <= todayIso
}

/**
 * Non-current mandates that have already begun — genuine past terms, browsable as archives.
 * Future mandates (not yet started) are excluded until their start date, so a term added to
 * MANDATES ahead of time does not surface as an empty archive.
 *
 * This is the ONLY archive list: it drives both user-facing navigation (switcher, sitemap)
 * AND the archive routes' `generateStaticParams`. While it is empty (no past mandate yet), the
 * archive `[mandate]` routes prerender zero paths; combined with `export const dynamicParams =
 * false` on every archive route, that makes them purely static (no on-demand Node function), so
 * they serve only 404s and Cloudflare's `next-on-pages` adapter has nothing to reject. When a
 * mandate ends and the next begins, this list fills and the real archive pages prerender.
 */
export const ARCHIVED_MANDATES: Mandate[] = MANDATES.filter(
  (m) => m.id !== CURRENT_MANDATE.id && mandateHasBegun(m)
)

/** Look up a mandate by id. */
export function mandateById(id: string): Mandate | undefined {
  return MANDATES.find((m) => m.id === id)
}

/**
 * Adjective for a mandate's in-chamber members: "current" while the mandate is live,
 * "sitting" once it is archived (a past mandate has no members "current" today). Use this
 * ONLY where a stat is genuinely scoped to sitting members (is_current) so the distinction
 * from former members stays clear; where a stat covers every member of the term, drop the
 * qualifier entirely instead.
 */
export function sittingAdjective(m: Mandate): string {
  return m.isCurrent ? 'current' : 'sitting'
}

/**
 * Map an ISO date (or longer date-like string) to the mandate it falls within.
 * If more than one mandate's window matches (e.g. an open-ended older mandate plus a
 * newer one), the mandate with the latest start wins — so appending the next term to
 * MANDATES is all that's needed at a boundary; the old entry needs no hand-editing.
 */
export function dateToMandate(date: string | Date): Mandate | null {
  const d = (typeof date === 'string' ? date : date.toISOString()).slice(0, 10)
  const matches = MANDATES.filter((m) => d >= m.start && (m.end === null || d <= m.end))
  if (matches.length === 0) return null
  return matches.reduce((latest, m) => (m.start > latest.start ? m : latest))
}

/** Like dateToMandate but returns the id and throws on an unmapped date (fail loud). */
export function mandateIdForDate(date: string | Date): string {
  const m = dateToMandate(date)
  if (!m) throw new Error(`No mandate covers date "${date}" — add it to MANDATES in lib/constants/mandates.ts`)
  return m.id
}
