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
    // The next term, added ahead of time so sync scripts can attribute data to it the moment
    // it starts and so it's ready to flip to `isCurrent` at the boundary. See the PIVOT
    // RUNBOOK below for everything that flip actually involves — it is not just this flag.
    id: '2027-2032',
    label: '2027–2032',
    startLabel: 'May 2027',
    electionDate: '2027-05-06',
    start: '2027-05-08',
    end: null,
    isCurrent: false,
  },
]

// ============================================================================================
// PIVOT RUNBOOK — moving the live site from 2022-2027 to 2027-2032 (do this on or after
// 2027-05-08, once real Assembly data for the new mandate exists to sync in)
// ============================================================================================
//
// The site is fully static (built once from the DB, redeployed on every sync — no route ever
// queries the DB at request time). "Pivoting" the mandate means: the live /assembly/** routes
// switch from serving 2022-2027 data to 2027-2032 data, and 2022-2027 gets frozen and moved to
// a new /archive/2022-2027/** route so its exact numbers stay browsable forever, unaffected by
// anything that happens to 2027-2032 afterwards. None of this touches DB rows — every mandate's
// rows already sit in the DB tagged by `mandate` column, written via mandateIdForDate(date) for
// dated records (divisions, votes, bills, hansard) or mandateForToday().id for "current roster"
// snapshot writes with no per-record date (ministers, chairs, interests, member terms) — never
// a hardcoded id, and never deleted/rewritten once written for a past mandate. Because both
// derive from the actual calendar date rather than the isCurrent flag below, new-term data is
// already attributed correctly by the nightly cron even on days before step 1 is deployed — no
// need to pause the sync cron around the boundary. This is purely a routing + static-rebuild step.
//
// Steps, in order, in a single PR:
//
//   1. In MANDATES above: set 2022-2027's `end` to its final day, flip `isCurrent: false` on
//      2022-2027 and `isCurrent: true` on 2027-2032. CURRENT_MANDATE now resolves to 2027-2032,
//      so every existing /assembly/** live route (which imports CURRENT_MANDATE directly, no
//      code change needed) starts querying and rendering 2027-2032 data on the next build.
//
//   2. Freeze 2022-2027 as an archive: copy the ENTIRE app/archive/2027-2032/ folder tree
//      (layout.tsx + all ~20 page.tsx files, including the nested [id]/[slug] routes) to a new
//      app/archive/2022-2027/ folder, then find-replace the hardcoded '2027-2032' id string
//      with '2022-2027' in every copied file (each file does `mandateById('2027-2032')!` —
//      that's the only per-file edit needed). This is what makes /archive/2022-2027 real: it
//      queries the DB at build time scoped to mandate = '2022-2027' and bakes the result into
//      static HTML — a permanent snapshot, since those DB rows never change again.
//
//   3. Delete the OLD app/archive/2027-2032/ folder. It's about to be wrong in two ways: (a)
//      2027-2032 is now the live mandate, served at the bare /assembly/** paths, not under
//      /archive/; (b) leaving it in place would 404-loop or duplicate content. (ARCHIVED_
//      MANDATES will stop listing 2027-2032 once isCurrent flips, so nothing links to
//      /archive/2027-2032 anymore anyway — deleting the folder just removes the dead route.)
//
//   4. Run a full sync (npm run sync / sync-full) against the live 2027-2032 Assembly data,
//      then rebuild + redeploy. Confirm: /assembly/** shows 2027-2032 content; the mandate
//      switcher lists "2022–2027 · archive" linking to /archive/2022-2027 with the exact
//      frozen data; /archive/2022-2027 has no dependency on anything written for 2027-2032
//      afterwards (separate DB rows, separate static build output — no bleed either direction).
//
//   5. Optional cleanup: four one-off analysis/import scripts hardcode '2022-2027'
//      (mandate-cost-breakdown.mjs, import-expenses.py, import-historical-expenses.ts,
//      backfill-parent-motion-text.ts). None run automatically (not part of `npm run sync`),
//      so they're not a pivot blocker — just don't reuse them for 2027-2032 figures without
//      updating the hardcoded id first.
//
// The transition AFTER this one (2032-2037) follows the same shape: flip MANDATES, copy
// whichever folder is currently the live mandate's archive-in-waiting... except at that point
// there won't be one yet, so instead copy app/archive/2022-2027/ (or literally any existing
// archive folder) as a template, find-replace its id to '2032-2037', and repeat steps 2-5
// above with 2027-2032 as the outgoing mandate being archived.
// ============================================================================================

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
 * MANDATES ahead of time does not surface as an empty archive. Use this for user-facing lists
 * (switcher, sitemap).
 */
export const ARCHIVED_MANDATES: Mandate[] = MANDATES.filter(
  (m) => m.id !== CURRENT_MANDATE.id && mandateHasBegun(m),
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

/**
 * The mandate covering today's actual date — for sync writes with no natural per-record date
 * (ministers, committee chairs, registered interests, member-term snapshots are "current
 * roster" API snapshots, not dated events, so there's nothing to run mandateIdForDate on).
 * Unlike CURRENT_MANDATE (a manually flipped display flag), this is correct the moment a new
 * mandate's start date arrives, regardless of whether the isCurrent-flip PR has been deployed
 * yet — closing the race where a cron run before that deploy could misattribute new-term data
 * into the outgoing mandate and then delete it via the "not in the fresh roster" cleanup.
 */
export function mandateForToday(todayIso: string = TODAY_ISO): Mandate {
  return dateToMandate(todayIso) ?? CURRENT_MANDATE
}
