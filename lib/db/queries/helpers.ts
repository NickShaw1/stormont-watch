import { sql } from 'drizzle-orm'
import { CURRENT_MANDATE as CURRENT_MANDATE_CONFIG, mandateById } from '@/lib/constants/mandates'

export const mlaImg = (personId: string | null | undefined): string | null =>
  personId ? `/mla-images/${personId}.jpg` : null

export const CURRENT_MANDATE = CURRENT_MANDATE_CONFIG.id
/** First day of the current mandate, e.g. '2022-05-05'. */
export const CURRENT_MANDATE_START = CURRENT_MANDATE_CONFIG.start

// Month-range bounds for a mandate's trend charts: its own start to end/NOW().
export function trendBounds(mandate: string) {
  const meta = mandateById(mandate)
  const start = meta?.start ?? CURRENT_MANDATE_START
  return {
    startSql: sql`${start}::timestamptz`,
    endSql: meta?.end ? sql`${meta.end}::timestamptz` : sql`NOW()`,
  }
}

// First day of the given mandate as an ISO date string.
export function mandateStartOf(mandate: string): string {
  return mandateById(mandate)?.start ?? CURRENT_MANDATE_START
}

// Reads member_role_history, not the wipeable assembly_role_start/end columns.
export function notServingAsSpeaker(personIdSql: ReturnType<typeof sql>, divisionDateSql: ReturnType<typeof sql>) {
  return sql`NOT EXISTS (
    SELECT 1 FROM member_role_history mrh
    WHERE mrh.person_id = ${personIdSql}
    AND mrh.role = 'Speaker'
    AND ${divisionDateSql}::date >= mrh.start_date
    AND (mrh.end_date IS NULL OR ${divisionDateSql}::date < mrh.end_date)
  )`
}

// Same as notServingAsSpeaker but excludes all presiding officers (Speaker, Deputy Speaker,
// Principal Deputy Speaker), for leaderboards that deliberately rank only backbench MLAs.
// Reads member_role_history, not the wipeable assembly_role_start/end columns.
export function notServingAsPresidingOfficer(personIdSql: ReturnType<typeof sql>, divisionDateSql: ReturnType<typeof sql>) {
  return sql`NOT EXISTS (
    SELECT 1 FROM member_role_history mrh
    WHERE mrh.person_id = ${personIdSql}
    AND mrh.role IN ('Speaker', 'Deputy Speaker', 'Principal Deputy Speaker')
    AND ${divisionDateSql}::date >= mrh.start_date
    AND (mrh.end_date IS NULL OR ${divisionDateSql}::date < mrh.end_date)
  )`
}

// A member currently (open-ended role_history row) holding a presiding-officer role — used to
// drop them from a leaderboard entirely, not just exclude their in-role divisions from the
// count. A FORMER presiding officer (role has since ended) is not matched, so they reappear
// on the leaderboard once they return to being a regular MLA.
export function isCurrentPresidingOfficer(personIdSql: ReturnType<typeof sql>) {
  return sql`EXISTS (
    SELECT 1 FROM member_role_history mrh
    WHERE mrh.person_id = ${personIdSql}
    AND mrh.role IN ('Speaker', 'Deputy Speaker', 'Principal Deputy Speaker')
    AND mrh.end_date IS NULL
  )`
}
