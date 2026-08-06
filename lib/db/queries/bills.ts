import { eq, desc, sql, and, count, isNull, lte } from 'drizzle-orm'
import { db } from '../client'
import { hansardReports, bills } from '../schema'
import { CURRENT_MANDATE, mandateStartOf } from './helpers'

export async function getAllBills(mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    SELECT
      b.bill_id,
      b.short_title,
      b.long_title,
      b.bill_type,
      b.is_accelerated,
      b.current_stage,
      CASE
        WHEN b.current_stage ~* '^(amendment|clause|schedule|long title)[^-]*- (.+)$'
        THEN regexp_replace(b.current_stage, '^[^-]+-\s*', '', 'i')
        ELSE b.current_stage
      END as display_stage,
      b.royal_assent_date,
      b.act_title,
      b.legislation_url,
      b.latest_date,
      COUNT(bs.document_id)::int as stage_count,
      COUNT(bs.division_id)::int as division_count,
      fs_plain.has_division as final_stage_has_division,
      d.outcome as final_stage_outcome,
      CASE WHEN fs_plain.has_division = false THEN fs_plain.plenary_date ELSE NULL END as final_stage_nodiv_date,
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object('stage', h.stage, 'plenaryDate', h.plenary_date::text)
          ORDER BY h.plenary_date ASC
        ), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (bs2.stage, bs2.plenary_date::date)
            bs2.stage, bs2.plenary_date
          FROM bill_stages bs2
          WHERE bs2.bill_id = b.bill_id
          ORDER BY bs2.stage, bs2.plenary_date::date,
                   (bs2.item_title IS NULL) DESC, bs2.document_id ASC
        ) h
      ) as stage_history
    FROM bills b
    LEFT JOIN bill_stages bs ON b.bill_id = bs.bill_id
    LEFT JOIN LATERAL (
      SELECT bs.document_id, bs.plenary_date, bs.has_division, bs.division_id
      FROM bill_stages bs
      WHERE bs.bill_id = b.bill_id
        AND LOWER(bs.stage) = 'final stage'
        AND bs.item_title IS NULL
      ORDER BY bs.plenary_date DESC
      LIMIT 1
    ) fs_plain ON true
    LEFT JOIN divisions d ON d.document_id = fs_plain.division_id
    WHERE b.mandate = ${mandate}
    GROUP BY b.bill_id, b.short_title, b.long_title, b.bill_type, b.is_accelerated, b.current_stage, b.latest_date, b.royal_assent_date, b.act_title, b.legislation_url, fs_plain.has_division, d.outcome, fs_plain.plenary_date
    ORDER BY b.latest_date DESC
  `)
  return result.rows as {
    bill_id: string
    short_title: string
    long_title: string | null
    bill_type: string | null
    is_accelerated: boolean
    current_stage: string
    display_stage: string
    royal_assent_date: string | null
    act_title: string | null
    legislation_url: string | null
    latest_date: string
    stage_count: number
    division_count: number
    final_stage_has_division: boolean | null
    final_stage_outcome: string | null
    final_stage_nodiv_date: string | null
    stage_history: { stage: string; plenaryDate: string }[]
  }[]
}

export async function getBillStages(billId: string) {
  const result = await db.execute(sql`
    SELECT
      bs.document_id,
      bs.stage,
      bs.plenary_date,
      bs.has_division,
      bs.division_id,
      bs.item_title,
      d.outcome,
      d.total_ayes,
      d.total_noes,
      d.division_type
    FROM bill_stages bs
    LEFT JOIN divisions d ON bs.division_id = d.document_id
    WHERE bs.bill_id = ${billId}
    ORDER BY bs.plenary_date ASC, bs.stage ASC
  `)
  return result.rows as {
    document_id: string
    stage: string
    plenary_date: string
    has_division: boolean
    division_id: string | null
    item_title: string | null
    outcome: string | null
    total_ayes: number | null
    total_noes: number | null
    division_type: string | null
  }[]
}

export async function getHansardReportId(plenaryDate: string): Promise<string | null> {
  const dateOnly = plenaryDate.slice(0, 10)
  const result = await db
    .select({ reportDocId: hansardReports.reportDocId })
    .from(hansardReports)
    .where(eq(hansardReports.plenaryDate, dateOnly))
    .limit(1)
  return result[0]?.reportDocId ?? null
}

export async function getBillsPassedPerMonth(mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    SELECT
      gs.month,
      COALESCE(b.bills_passed, 0) as bills_passed
    FROM generate_series(
      DATE_TRUNC('month', NOW()) - INTERVAL '23 months',
      DATE_TRUNC('month', NOW()),
      INTERVAL '1 month'
    ) AS gs(month)
    LEFT JOIN (
      SELECT
        DATE_TRUNC('month', royal_assent_date) as month,
        COUNT(*) as bills_passed
      FROM bills
      WHERE royal_assent_date >= ${mandateStartOf(mandate)}
        AND mandate = ${mandate}
      GROUP BY DATE_TRUNC('month', royal_assent_date)
    ) b ON gs.month = b.month
    ORDER BY gs.month ASC
  `)
  return result.rows as { month: string; bills_passed: number }[]
}

export async function getPassRateByYear(mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    SELECT
      EXTRACT(YEAR FROM division_date) as year,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE
        outcome ILIKE '%carried%' OR
        outcome ILIKE '%agreed%' OR
        outcome ILIKE '%passed%'
      ) as passed,
      ROUND(
        COUNT(*) FILTER (WHERE
          outcome ILIKE '%carried%' OR
          outcome ILIKE '%agreed%' OR
          outcome ILIKE '%passed%'
        ) * 100.0 / NULLIF(COUNT(*), 0)
      ) as pass_rate
    FROM divisions
    WHERE mandate = ${mandate}
    GROUP BY year
    ORDER BY year ASC
  `)
  return result.rows as { year: number; total: number; passed: number; pass_rate: number }[]
}

export async function getBillsProgressedThisWeek(mandate: string = CURRENT_MANDATE): Promise<{
  weekEvents: {
    bill_id: string
    short_title: string
    bill_type: string | null
    is_accelerated: boolean
    royal_assent_date: string | null
    mandate: string
    stage: string
    plenary_date: string
    has_division: boolean
    outcome: string | null
    event_type: 'voted' | 'passed'
  }[]
  fullHistory: {
    bill_id: string
    stage: string
    plenary_date: string
    has_division: boolean
  }[]
}> {
  // Past-only window: Monday 00:00 UTC to now.
  // DISTINCT ON (bill_id, stage, plenary_date) collapses clause/amendment rows into one
  // representative row per stage event, preferring plain rows (item_title IS NULL) then lowest doc_id.
  const weekResult = await db.execute(sql`
    SELECT DISTINCT ON (bs.bill_id, bs.stage, bs.plenary_date)
      b.bill_id,
      b.short_title,
      b.bill_type,
      b.is_accelerated,
      b.royal_assent_date::text as royal_assent_date,
      b.mandate,
      bs.stage,
      bs.plenary_date::text as plenary_date,
      bs.has_division,
      d.outcome,
      CASE
        WHEN bs.has_division = true THEN 'voted'
        ELSE 'passed'
      END as event_type
    FROM bill_stages bs
    JOIN bills b ON bs.bill_id = b.bill_id
    LEFT JOIN divisions d ON bs.division_id = d.document_id
    WHERE bs.mandate = ${mandate}
      AND bs.plenary_date >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
      AND bs.plenary_date < CURRENT_DATE AT TIME ZONE 'UTC'
    ORDER BY bs.bill_id, bs.stage, bs.plenary_date,
             (bs.item_title IS NULL) DESC,
             bs.document_id ASC
  `)

  const weekEvents = weekResult.rows as {
    bill_id: string; short_title: string; bill_type: string | null; is_accelerated: boolean
    royal_assent_date: string | null; mandate: string; stage: string; plenary_date: string
    has_division: boolean; outcome: string | null; event_type: 'voted' | 'passed'
  }[]

  if (weekEvents.length === 0) return { weekEvents: [], fullHistory: [] }

  // fullHistory has NO date filter — future rows drive the striped "scheduled" segment on the progress bar.
  // Same DISTINCT ON pattern to deduplicate clause/amendment rows.
  const histResult = await db.execute(sql`
    SELECT DISTINCT ON (bs.bill_id, bs.stage, bs.plenary_date)
      bs.bill_id, bs.stage, bs.plenary_date::text as plenary_date, bs.has_division
    FROM bill_stages bs
    WHERE bs.bill_id IN (
      SELECT DISTINCT bill_id FROM bill_stages
      WHERE mandate = ${mandate}
        AND plenary_date >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
        AND plenary_date <= NOW()
    )
    ORDER BY bs.bill_id, bs.stage, bs.plenary_date,
             (bs.item_title IS NULL) DESC,
             bs.document_id ASC
  `)

  return {
    weekEvents,
    fullHistory: histResult.rows as { bill_id: string; stage: string; plenary_date: string; has_division: boolean }[],
  }
}

export async function getInProgressBills(limit = 5, mandate: string = CURRENT_MANDATE) {
  return db
    .select({
      billId: bills.billId,
      shortTitle: bills.shortTitle,
      billType: bills.billType,
      currentStage: bills.currentStage,
      isAccelerated: bills.isAccelerated,
      latestDate: bills.latestDate,
    })
    .from(bills)
    .where(and(
      isNull(bills.royalAssentDate),
      lte(bills.latestDate, sql`NOW()`),
      eq(bills.mandate, mandate)
    ))
    .orderBy(desc(bills.latestDate))
    .limit(limit)
}

export async function getActiveBillsCount(mandate: string = CURRENT_MANDATE): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(bills)
    .where(and(isNull(bills.royalAssentDate), eq(bills.mandate, mandate)))
  return result[0]?.count ?? 0
}
