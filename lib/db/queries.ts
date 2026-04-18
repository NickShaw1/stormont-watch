import { eq, desc, sql, and, count, countDistinct, isNotNull, isNull, gte, lte, asc } from 'drizzle-orm'
import { db } from './client'
import { members, divisions, votes, hansardReports, ministers, committeeChairs, expenses, registeredInterests, bills, billStages } from './schema'
import { stripHonorifics } from '@/lib/utils/formatNames'
import { getSurname } from '@/lib/format'

const mlaImg = (personId: string | null | undefined): string | null =>
  personId ? `/mla-images/${personId}.jpg` : null

const CURRENT_MANDATE = '2022-2027'

export async function getMembersByConstituency(constituency: string) {
  const rows = await db
    .select({
      personId: members.personId,
      fullName: members.fullName,
      party: members.party,
      imgUrl: members.imgUrl,
    })
    .from(members)
    .where(and(
      eq(members.constituency, constituency),
      eq(members.isCurrent, true)
    ))
    .orderBy(asc(members.fullName))
  return rows.map(r => ({ ...r, imgUrl: mlaImg(r.personId) }))
}

export async function getMemberById(personId: string) {
  const result = await db
    .select()
    .from(members)
    .where(eq(members.personId, personId))
    .limit(1)
  const row = result[0] ?? null
  if (!row) return null
  return { ...row, imgUrl: mlaImg(row.personId) }
}

export async function getAllMembers() {
  return db.select().from(members).where(eq(members.isCurrent, true)).orderBy(members.fullName)
}

export async function getAllMembersIncludingFormer() {
  // Only current-mandate members (2022-present). Static pages for pre-2022 MLAs are not generated
  // because the site does not cover that era.
  return db
    .select({ personId: members.personId })
    .from(members)
    .where(and(isNotNull(members.mandateStart), gte(members.mandateStart, '2022-05-05')))
    .orderBy(members.fullName)
}


export async function getDistinctPartyCount(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT party) as count
    FROM members
    WHERE is_current = true AND party IS NOT NULL AND party NOT ILIKE '%independent%'
  `)
  return Number((result.rows[0] as { count: string | number })?.count ?? 0)
}

export async function getMemberVotingHistory(personId: string) {
  return db
    .select({
      vote: votes.vote,
      subject: divisions.subject,
      title: divisions.title,
      tabledBy: divisions.tabledBy,
      divisionDate: divisions.divisionDate,
      outcome: divisions.outcome,
      documentId: divisions.documentId,
      divisionType: divisions.divisionType,
    })
    .from(votes)
    .innerJoin(divisions, eq(votes.documentId, divisions.documentId))
    .where(eq(votes.personId, personId))
    .orderBy(desc(divisions.divisionDate))
}

export async function getDivisionWithVotes(documentId: string) {
  const division = await db
    .select()
    .from(divisions)
    .where(eq(divisions.documentId, documentId))
    .limit(1)

  if (!division[0]) return null

  const divisionVotes = await db
    .select({
      vote: votes.vote,
      designation: votes.designation,
      personId: members.personId,
      fullName: members.fullName,
      party: members.party,
    })
    .from(votes)
    .innerJoin(members, eq(votes.personId, members.personId))
    .where(eq(votes.documentId, documentId))
    .orderBy(votes.vote, members.fullName)

  return { division: division[0], votes: divisionVotes }
}

export async function getAllDivisionsFromDb() {
  return db
    .select()
    .from(divisions)
    .orderBy(desc(divisions.divisionDate))
}

export async function getAllDivisionsForList() {
  return db
    .select({
      documentId: divisions.documentId,
      subject: divisions.subject,
      divisionDate: divisions.divisionDate,
      outcome: divisions.outcome,
      divisionType: divisions.divisionType,
      totalAyes: divisions.totalAyes,
      totalNoes: divisions.totalNoes,
      title: divisions.title,
      motionText: divisions.motionText,
    })
    .from(divisions)
    .orderBy(desc(divisions.divisionDate))
}

export async function getFormerMembers() {
  const rows = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.isCurrent, false),
        sql`${members.mandateStart} >= '2022-01-01'`
      )
    )
    .orderBy(desc(members.mandateEnd))

  const grouped: Record<string, typeof rows> = {}
  for (const m of rows) {
    const party = m.party ?? 'Independent'
    if (!grouped[party]) grouped[party] = []
    grouped[party].push(m)
  }
  return Object.entries(grouped)
    .map(([party, mlas]) => ({
      party,
      mlas: mlas.sort((a, b) =>
        getSurname(a.fullName).localeCompare(getSurname(b.fullName))
      ),
    }))
    .sort((a, b) => b.mlas.length - a.mlas.length)
}

export async function getMembersGroupedByParty() {
  const result = await db.execute(sql`
    SELECT
      m.person_id,
      m.full_name,
      m.party,
      m.constituency,
      m.img_url,
      m.mandate_start,
      m.assembly_role,
      m.assembly_role_start,
      m.assembly_role_end,
      CASE
        WHEN m.assembly_role IS NOT NULL AND m.assembly_role_end IS NULL THEN NULL
        ELSE ROUND(
          COUNT(v.id) FILTER (WHERE v.vote != 'NO_SHOW') * 100.0 /
          NULLIF(COUNT(v.id) FILTER (WHERE
            (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::timestamptz) AND
            (m.assembly_role IS NULL OR m.assembly_role_end IS NOT NULL OR
             d.division_date < m.assembly_role_start::timestamptz)
          ), 0)
        )
      END as attendance_pct
    FROM members m
    LEFT JOIN votes v ON m.person_id = v.person_id
    LEFT JOIN divisions d ON v.document_id = d.document_id
    WHERE m.is_current = true
    GROUP BY m.person_id, m.full_name, m.party, m.constituency, m.img_url,
             m.mandate_start, m.assembly_role, m.assembly_role_start, m.assembly_role_end
    ORDER BY m.party, m.full_name
  `)

  type GroupedMlaRow = {
    person_id: string
    full_name: string
    party: string | null
    constituency: string | null
    img_url: string | null
    assembly_role: string | null
    assembly_role_end: string | null
    attendance_pct: number | null
    [key: string]: unknown
  }
  const grouped: Record<string, GroupedMlaRow[]> = {}
  for (const row of result.rows as GroupedMlaRow[]) {
    const party = row.party ?? 'Independent'
    if (!grouped[party]) grouped[party] = []
    grouped[party].push({ ...row, img_url: mlaImg(String(row.person_id)) })
  }

  return Object.entries(grouped)
    .map(([party, mlas]) => ({
      party,
      mlas: mlas.sort((a: GroupedMlaRow, b: GroupedMlaRow) =>
        getSurname(a.full_name).localeCompare(getSurname(b.full_name))
      ),
    }))
    .sort((a, b) => b.mlas.length - a.mlas.length)
}

export async function getMlaLeaderboard() {
  const rows = await db
    .select({
      personId: members.personId,
      fullName: members.fullName,
      party: members.party,
      constituency: members.constituency,
      imgUrl: members.imgUrl,
      mandateStart: members.mandateStart,
      total: sql<number>`count(*)::int`,
      present: sql<number>`count(*) filter (where ${votes.vote} != 'NO_SHOW')::int`,
      ayes: sql<number>`count(*) filter (where ${votes.vote} = 'AYE')::int`,
      noes: sql<number>`count(*) filter (where ${votes.vote} = 'NO')::int`,
    })
    .from(votes)
    .innerJoin(members, eq(votes.personId, members.personId))
    .innerJoin(
      divisions,
      and(
        eq(votes.documentId, divisions.documentId),
        sql`${divisions.divisionDate} >= coalesce(${members.mandateStart}::date, '2022-05-01'::date)`
      )
    )
    .where(and(eq(members.isCurrent, true), sql`${members.assemblyRole} is null`))
    .groupBy(members.personId, members.fullName, members.party, members.constituency, members.imgUrl, members.mandateStart)

  return rows.map((r) => ({
    ...r,
    imgUrl: mlaImg(r.personId),
    attendancePct: r.total > 0 ? Math.round((r.present / r.total) * 100) : 0,
  }))
}

export async function getAssemblyStats() {
  const [totalDivisions, crossCommunityCount, mostContested, mostUnanimous] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(divisions).where(eq(divisions.mandate, CURRENT_MANDATE)),
    db.select({ count: sql<number>`count(*)` }).from(divisions).where(and(eq(divisions.divisionType, 'Cross-Community'), eq(divisions.mandate, CURRENT_MANDATE))),
    db.select().from(divisions).where(and(sql`total_ayes + total_noes > 0`, eq(divisions.mandate, CURRENT_MANDATE))).orderBy(sql`ABS(total_ayes - total_noes) ASC`).limit(1),
    db.select().from(divisions).where(and(sql`total_ayes + total_noes > 0`, eq(divisions.mandate, CURRENT_MANDATE))).orderBy(sql`total_ayes::float / (total_ayes + total_noes) DESC`).limit(1),
  ])
  return {
    totalDivisions: Number(totalDivisions[0]?.count ?? 0),
    crossCommunityCount: Number(crossCommunityCount[0]?.count ?? 0),
    mostContested: mostContested[0] ?? null,
    mostUnanimous: mostUnanimous[0] ?? null,
  }
}

export async function getAverageAttendance(): Promise<number> {
  const result = await db.execute(sql`
    SELECT ROUND(AVG(attendance_pct)::numeric, 1) as avg_pct
    FROM (
      SELECT
        m.person_id,
        COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW') * 100.0 / COUNT(*) as attendance_pct
      FROM members m
      JOIN votes v ON m.person_id = v.person_id
      WHERE m.is_current = true
      AND m.assembly_role IS NULL
      AND v.mandate = ${CURRENT_MANDATE}
      GROUP BY m.person_id
    ) attendance
  `)
  return Number(result.rows[0]?.avg_pct ?? 0)
}

export async function getPartyCohesion(): Promise<{ party: string; cohesionPct: number; memberCount: number }[]> {
  const result = await db.execute(sql`
    SELECT
      m.party,
      COUNT(DISTINCT m.person_id) as member_count,
      ROUND(
        COUNT(*) FILTER (WHERE party_unified = true) * 100.0 / NULLIF(COUNT(*), 0)
      , 1) as cohesion_pct
    FROM members m
    JOIN (
      SELECT
        v.document_id,
        m2.party,
        COUNT(DISTINCT v.vote) FILTER (WHERE v.vote != 'NO_SHOW') = 1 as party_unified
      FROM votes v
      JOIN members m2 ON v.person_id = m2.person_id
      WHERE m2.is_current = true
      AND m2.assembly_role IS NULL
      AND v.vote != 'NO_SHOW'
      AND v.mandate = ${CURRENT_MANDATE}
      GROUP BY v.document_id, m2.party
    ) party_votes ON m.party = party_votes.party
    WHERE m.is_current = true
    AND m.assembly_role IS NULL
    AND m.party IS NOT NULL
    GROUP BY m.party
    HAVING COUNT(DISTINCT m.person_id) > 1
    ORDER BY cohesion_pct DESC
  `)
  type CohesionRow = { party: string; cohesion_pct: unknown; member_count: unknown }
  return (result.rows as unknown as CohesionRow[]).map((r) => ({
    party: r.party,
    cohesionPct: Number(r.cohesion_pct),
    memberCount: Number(r.member_count),
  }))
}

export async function getMostRebelliousMla(): Promise<{
  personId: string
  fullName: string
  party: string
  constituencyName: string
  rebellionPct: number
  rebellionCount: number
  imgUrl: string | null
} | null> {
  const result = await db.execute(sql`
    WITH party_majority AS (
      SELECT
        v.document_id,
        m.party,
        MODE() WITHIN GROUP (ORDER BY v.vote) FILTER (WHERE v.vote != 'NO_SHOW') as majority_vote
      FROM votes v
      JOIN members m ON v.person_id = m.person_id
      WHERE m.is_current = true
      AND m.assembly_role IS NULL
      AND v.mandate = ${CURRENT_MANDATE}
      GROUP BY v.document_id, m.party
    ),
    mla_rebellions AS (
      SELECT
        m.person_id,
        m.full_name,
        m.party,
        m.constituency,
        m.img_url,
        COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW' AND v.vote != pm.majority_vote) as rebellion_count,
        COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW') as votes_cast,
        ROUND(
          COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW' AND v.vote != pm.majority_vote) * 100.0
          / NULLIF(COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW'), 0)
        , 1) as rebellion_pct
      FROM votes v
      JOIN members m ON v.person_id = m.person_id
      JOIN party_majority pm ON v.document_id = pm.document_id AND m.party = pm.party
      WHERE m.is_current = true
      AND m.assembly_role IS NULL
      AND m.party != 'Independent'
      AND v.mandate = ${CURRENT_MANDATE}
      GROUP BY m.person_id, m.full_name, m.party, m.constituency, m.img_url
      HAVING COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW') > 10
    )
    SELECT * FROM mla_rebellions
    ORDER BY rebellion_pct DESC
    LIMIT 1
  `)
  if (!result.rows[0]) return null
  type RebelRow = { person_id: string; full_name: string; party: string; constituency: string; rebellion_pct: unknown; rebellion_count: unknown; img_url: string | null }
  const r = result.rows[0] as RebelRow
  return {
    personId: r.person_id,
    fullName: r.full_name,
    party: r.party,
    constituencyName: r.constituency,
    rebellionPct: Number(r.rebellion_pct),
    rebellionCount: Number(r.rebellion_count),
    imgUrl: mlaImg(r.person_id),
  }
}

export async function getMostCrossCommunityAgreement(): Promise<typeof divisions.$inferSelect | null> {
  const result = await db.execute(sql`
    SELECT *,
      LEAST(
        nationalist_ayes::float / NULLIF(nationalist_ayes + nationalist_noes, 0),
        unionist_ayes::float / NULLIF(unionist_ayes + unionist_noes, 0)
      ) as min_aye_pct
    FROM divisions
    WHERE nationalist_ayes + nationalist_noes > 3
    AND unionist_ayes + unionist_noes > 3
    AND mandate = ${CURRENT_MANDATE}
    ORDER BY min_aye_pct DESC
    LIMIT 1
  `)
  return (result.rows[0] as typeof divisions.$inferSelect) ?? null
}

export async function getMemberStructureRole(personId: string): Promise<
  | { type: 'minister'; roleTitle: string; department: string }
  | { type: 'committeeChair'; committeeName: string }
  | null
> {
  const [ministerRow, chairRow] = await Promise.all([
    db.select({ roleTitle: ministers.roleTitle, department: ministers.department })
      .from(ministers)
      .where(eq(ministers.personId, personId))
      .limit(1),
    db.select({ committeeName: committeeChairs.committeeName })
      .from(committeeChairs)
      .where(eq(committeeChairs.personId, personId))
      .limit(1),
  ])
  if (ministerRow[0]) {
    return {
      type: 'minister',
      roleTitle: ministerRow[0].roleTitle ?? ministerRow[0].department,
      department: ministerRow[0].department,
    }
  }
  if (chairRow[0]) {
    return { type: 'committeeChair', committeeName: chairRow[0].committeeName }
  }
  return null
}

export async function getAllMinisters() {
  const rows = await db
    .select({
      personId: ministers.personId,
      department: ministers.department,
      roleTitle: ministers.roleTitle,
      fullName: members.fullName,
      party: members.party,
      imgUrl: members.imgUrl,
    })
    .from(ministers)
    .innerJoin(members, eq(ministers.personId, members.personId))
    .orderBy(ministers.department)
  return rows.map(r => ({ ...r, imgUrl: mlaImg(r.personId) }))
}

export async function getAllCommitteeChairs() {
  const rows = await db
    .select({
      personId: committeeChairs.personId,
      committeeName: committeeChairs.committeeName,
      fullName: members.fullName,
      party: members.party,
      imgUrl: members.imgUrl,
      assemblyRole: members.assemblyRole,
    })
    .from(committeeChairs)
    .innerJoin(members, eq(committeeChairs.personId, members.personId))
    .orderBy(committeeChairs.committeeName)
  return rows.map(r => ({ ...r, imgUrl: mlaImg(r.personId) }))
}

export async function getExpensesLeagueTable() {
  const rows = await db
    .select({
      personId: expenses.personId,
      fullName: members.fullName,
      party: members.party,
      constituency: members.constituency,
      imgUrl: members.imgUrl,
      mandateStart: members.mandateStart,
      total: expenses.total,
      staffCosts: expenses.staffCosts,
      constituencyOffice: expenses.constituencyOffice,
      allowances: expenses.allowances,
      otherExpenses: expenses.otherExpenses,
      financialYear: expenses.financialYear,
      period: expenses.period,
    })
    .from(expenses)
    .innerJoin(members, eq(expenses.personId, members.personId))
    .where(eq(members.isCurrent, true))
    .orderBy(desc(expenses.total))
  return rows.map(r => ({ ...r, imgUrl: mlaImg(r.personId) }))
}

export async function getMlasWithoutExpenses() {
  const result = await db.execute(sql`
    SELECT m.person_id, m.full_name, m.party, m.constituency, m.img_url, m.mandate_start
    FROM members m
    LEFT JOIN expenses e ON e.person_id = m.person_id
    WHERE m.is_current = true
      AND e.person_id IS NULL
    ORDER BY m.full_name
  `)
  return (result.rows as { person_id: string; full_name: string; party: string | null; constituency: string | null; img_url: string | null; mandate_start: string | null }[])
    .map(row => ({ ...row, img_url: mlaImg(row.person_id) }))
}

export async function getMemberExpenses(personId: string) {
  return db
    .select()
    .from(expenses)
    .where(eq(expenses.personId, personId))
    .orderBy(desc(expenses.financialYear))
}

export async function getMemberExpensesWithRank(personId: string) {
  const result = await db.execute(sql`
    WITH ranked AS (
      SELECT
        e.person_id,
        e.financial_year,
        e.period,
        e.constituency_office,
        e.other_expenses,
        e.allowances,
        e.staff_costs,
        e.total,
        RANK() OVER (ORDER BY e.total DESC) as rank,
        COUNT(*) OVER () as total_members
      FROM expenses e
      JOIN members m ON e.person_id = m.person_id
      WHERE e.financial_year = (SELECT MAX(financial_year) FROM expenses)
        AND m.is_current = true
    )
    SELECT * FROM ranked
    WHERE person_id = ${personId}
  `)
  return result.rows[0] ?? null
}

export async function getRegisteredInterestsByMember(personId: string) {
  return db
    .select()
    .from(registeredInterests)
    .where(eq(registeredInterests.personId, personId))
    .orderBy(registeredInterests.registerCategoryId, registeredInterests.registerEntryStartDate)
}

export async function getExpensesStats() {
  const result = await db.execute(sql`
    SELECT
      SUM(total) as total_all,
      AVG(total) as avg_total,
      MAX(total) as max_total,
      MIN(total) as min_total,
      financial_year,
      period
    FROM expenses
    GROUP BY financial_year, period
  `)
  return result.rows[0] ?? null
}

export async function getExpensesByParty() {
  const result = await db.execute(sql`
    SELECT
      m.party,
      SUM(e.total) as party_total,
      COUNT(DISTINCT e.person_id) as mla_count,
      SUM(e.total) / COUNT(DISTINCT e.person_id) as per_mla_avg
    FROM expenses e
    JOIN members m ON e.person_id = m.person_id
    WHERE e.financial_year = (SELECT MAX(financial_year) FROM expenses)
      AND m.is_current = true
    GROUP BY m.party
    ORDER BY party_total DESC
  `)
  return result.rows as {
    party: string
    party_total: number
    mla_count: number
    per_mla_avg: number
  }[]
}

export async function getAllBills() {
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
      b.latest_date,
      COUNT(bs.document_id) as stage_count,
      COUNT(bs.division_id) as division_count,
      fs.has_division as final_stage_has_division,
      d.outcome as final_stage_outcome
    FROM bills b
    LEFT JOIN bill_stages bs ON b.bill_id = bs.bill_id
    LEFT JOIN bill_stages fs ON b.bill_id = fs.bill_id
      AND LOWER(fs.stage) = 'final stage'
      AND fs.has_division = true
    LEFT JOIN divisions d ON d.document_id = fs.division_id
    GROUP BY b.bill_id, b.short_title, b.long_title, b.bill_type, b.is_accelerated, b.current_stage, b.latest_date, b.royal_assent_date, b.act_title, fs.has_division, d.outcome
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
    latest_date: string
    stage_count: number
    division_count: number
    final_stage_has_division: boolean | null
    final_stage_outcome: string | null
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


export async function getCrossCommunityTrends() {
  const result = await db.execute(sql`
    SELECT 
      gs.month,
      COALESCE(d.total_divisions, 0) as total_divisions,
      COALESCE(d.agreed_divisions, 0) as agreed_divisions,
      d.agreement_pct
    FROM generate_series(
      DATE_TRUNC('month', NOW()) - INTERVAL '23 months',
      DATE_TRUNC('month', NOW()),
      INTERVAL '1 month'
    ) AS gs(month)
    LEFT JOIN (
      SELECT 
        DATE_TRUNC('month', division_date) as month,
        COUNT(*) as total_divisions,
        COUNT(*) FILTER (WHERE
          unionist_ayes > unionist_noes AND nationalist_ayes > nationalist_noes
        ) as agreed_divisions,
        ROUND(
          COUNT(*) FILTER (WHERE
            unionist_ayes > unionist_noes AND nationalist_ayes > nationalist_noes
          ) * 100.0 / NULLIF(COUNT(*), 0)
        ) as agreement_pct
      FROM divisions
      WHERE division_date >= DATE_TRUNC('month', NOW()) - INTERVAL '23 months'
      GROUP BY DATE_TRUNC('month', division_date)
    ) d ON gs.month = d.month
    ORDER BY gs.month ASC
  `)
  return result.rows as {
    month: string
    total_divisions: number
    agreed_divisions: number
    agreement_pct: number | null
  }[]
}

export async function getOverallAgreementRate() {
  const result = await db.execute(sql`
    SELECT
      ROUND(
        COUNT(*) FILTER (WHERE
          unionist_ayes > unionist_noes AND nationalist_ayes > nationalist_noes
        ) * 100.0 / NULLIF(COUNT(*), 0)
      ) as agreement_pct
    FROM divisions
    WHERE mandate = ${CURRENT_MANDATE}
  `)
  return Number((result.rows[0] as { agreement_pct: unknown }).agreement_pct)
}

export async function getDivisionsPerMonth() {
  const result = await db.execute(sql`
    SELECT 
      gs.month,
      COALESCE(d.total_divisions, 0) as total_divisions
    FROM generate_series(
      DATE_TRUNC('month', NOW()) - INTERVAL '23 months',
      DATE_TRUNC('month', NOW()),
      INTERVAL '1 month'
    ) AS gs(month)
    LEFT JOIN (
      SELECT 
        DATE_TRUNC('month', division_date) as month,
        COUNT(*) as total_divisions
      FROM divisions
      WHERE division_date >= DATE_TRUNC('month', NOW()) - INTERVAL '23 months'
      GROUP BY DATE_TRUNC('month', division_date)
    ) d ON gs.month = d.month
    ORDER BY gs.month ASC
  `)
  return result.rows as { month: string; total_divisions: number }[]
}

export async function getPassRateByYear() {
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
    WHERE mandate = ${CURRENT_MANDATE}
    GROUP BY year
    ORDER BY year ASC
  `)
  return result.rows as { year: number; total: number; passed: number; pass_rate: number }[]
}

export async function getSittingDays(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as sitting_days
    FROM hansard_reports
    WHERE plenary_date >= '2022-05-01'
    AND mandate = '2022-2027'
  `)
  return Number(result.rows[0]?.sitting_days ?? 0)
}

export async function getLatestExpensesYear(): Promise<string> {
  const result = await db.execute(sql`SELECT MAX(financial_year) as latest FROM expenses`)
  return String(result.rows[0]?.latest ?? '')
}

export async function getHomepageStats() {
  const [
    totalDivisions,
    actsCount,
    thisWeekDivisions,
    thisWeekBills,
    lastSat,
    familyEmployed,
    thisWeekPassed,
    fundedVisits,
    outsideEmployment,
    giftsHospitality,
  ] = await Promise.all([
    db.select({ count: count() }).from(divisions),
    db.select({ count: count() }).from(bills).where(isNotNull(bills.royalAssentDate)),
    db.select({ count: count() }).from(divisions)
      .where(gte(divisions.divisionDate, sql`date_trunc('week', NOW())`)),
    db.select({ count: countDistinct(billStages.billId) }).from(billStages)
      .where(
        and(
          gte(billStages.plenaryDate, sql`date_trunc('week', NOW())`),
          lte(billStages.plenaryDate, sql`NOW()`)
        )
      ),
    db.select({ plenaryDate: hansardReports.plenaryDate })
      .from(hansardReports)
      .orderBy(desc(hansardReports.plenaryDate))
      .limit(1),
    db.select({ count: countDistinct(registeredInterests.personId) })
      .from(registeredInterests)
      .innerJoin(members, eq(registeredInterests.personId, members.personId))
      .where(and(
        eq(registeredInterests.registerCategoryId, '53'),
        eq(members.isCurrent, true)
      )),
    db.select({
      passed: sql<number>`COUNT(*) FILTER (WHERE outcome ILIKE '%carried%' OR outcome ILIKE '%agreed%' OR outcome ILIKE '%passed%')`,
      total: count(),
    })
    .from(divisions)
    .where(gte(divisions.divisionDate, sql`date_trunc('week', NOW())`)),
    db.select({ count: count() })
      .from(registeredInterests)
      .where(eq(registeredInterests.registerCategoryId, '48')),
    db.select({ count: countDistinct(registeredInterests.personId) })
      .from(registeredInterests)
      .innerJoin(members, eq(registeredInterests.personId, members.personId))
      .where(and(
        eq(registeredInterests.registerCategoryId, '45'),
        eq(members.isCurrent, true)
      )),
    db.select({ count: count() })
      .from(registeredInterests)
      .where(eq(registeredInterests.registerCategoryId, '47')),
  ])

  return {
    totalDivisions: totalDivisions[0]?.count ?? 0,
    actsCount: actsCount[0]?.count ?? 0,
    thisWeekDivisions: thisWeekDivisions[0]?.count ?? 0,
    thisWeekBills: thisWeekBills[0]?.count ?? 0,
    lastSat: lastSat[0]?.plenaryDate ?? null,
    familyEmployed: familyEmployed[0]?.count ?? 0,
    thisWeekPassRate: thisWeekDivisions[0]?.count > 0
      ? Math.round((thisWeekPassed[0]?.passed / thisWeekDivisions[0]?.count) * 100)
      : null,
    fundedVisits: fundedVisits[0]?.count ?? 0,
    outsideEmployment: outsideEmployment[0]?.count ?? 0,
    giftsHospitality: giftsHospitality[0]?.count ?? 0,
  }
}

export async function getLeastEngagedMLA() {
  const result = await db.execute(sql`
    SELECT
      m.person_id,
      m.full_name,
      m.party,
      m.img_url,
      COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) as attended,
      COUNT(*) as total,
      ROUND(
        100.0 * COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) / COUNT(*)
      ) as attendance_pct
    FROM votes v
    JOIN members m ON v.person_id = m.person_id
    JOIN divisions d ON v.document_id = d.document_id
    WHERE m.is_current = true
    AND (m.assembly_role IS NULL
         OR m.assembly_role NOT ILIKE '%speaker%')
    AND d.division_date >= m.mandate_start
    GROUP BY m.person_id, m.full_name, m.party, m.img_url
    ORDER BY attendance_pct ASC
    LIMIT 1
  `)
  const row = result.rows[0]
  if (!row) return null
  return {
    personId: String(row.person_id),
    fullName: stripHonorifics(String(row.full_name)),
    party: String(row.party),
    imgUrl: mlaImg(String(row.person_id)),
    attendancePct: Number(row.attendance_pct),
    attended: Number(row.attended),
    total: Number(row.total),
  }
}

export async function getMostEngagedMLA() {
  const result = await db.execute(sql`
    SELECT
      m.person_id,
      m.full_name,
      m.party,
      m.img_url,
      COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) as attended,
      COUNT(*) as total,
      ROUND(
        100.0 * COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) / COUNT(*)
      ) as attendance_pct
    FROM votes v
    JOIN members m ON v.person_id = m.person_id
    JOIN divisions d ON v.document_id = d.document_id
    WHERE m.is_current = true
    AND (m.assembly_role IS NULL
         OR m.assembly_role NOT ILIKE '%speaker%')
    AND d.division_date >= m.mandate_start
    GROUP BY m.person_id, m.full_name, m.party, m.img_url
    ORDER BY attendance_pct DESC
    LIMIT 1
  `)
  const row = result.rows[0]
  if (!row) return null
  return {
    personId: String(row.person_id),
    fullName: stripHonorifics(String(row.full_name)),
    party: String(row.party),
    imgUrl: mlaImg(String(row.person_id)),
    attendancePct: Number(row.attendance_pct),
    attended: Number(row.attended),
    total: Number(row.total),
  }
}

export async function getLatestDivisions(limit = 5) {
  return db
    .select({
      documentId: divisions.documentId,
      title: divisions.title,
      subject: divisions.subject,
      divisionDate: divisions.divisionDate,
      outcome: divisions.outcome,
    })
    .from(divisions)
    .orderBy(desc(divisions.divisionDate))
    .limit(limit)
}

export async function getThisWeekLegislation(): Promise<{ bill_id: string; short_title: string; bill_type: string | null; stage: string; plenary_date: string; has_division: boolean; outcome: string | null }[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (bs.bill_id)
      b.bill_id,
      b.short_title,
      b.bill_type,
      bs.stage,
      bs.plenary_date,
      bs.has_division,
      d.outcome
    FROM bill_stages bs
    JOIN bills b ON bs.bill_id = b.bill_id
    LEFT JOIN divisions d ON bs.division_id = d.document_id
    WHERE bs.plenary_date >= date_trunc('week', NOW())
      AND bs.plenary_date <= NOW()
      AND bs.item_title IS NULL
    ORDER BY bs.bill_id, bs.plenary_date DESC
  `)
  return result.rows as { bill_id: string; short_title: string; bill_type: string | null; stage: string; plenary_date: string; has_division: boolean; outcome: string | null }[]
}

export async function getInProgressBills(limit = 5) {
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
      sql`${bills.currentStage} NOT ILIKE '%final stage%'`,
      lte(bills.latestDate, sql`NOW()`)
    ))
    .orderBy(desc(bills.latestDate))
    .limit(limit)
}

export async function getInProgressBillsCount(): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(bills)
    .where(and(
      isNull(bills.royalAssentDate),
      sql`${bills.currentStage} NOT ILIKE '%final stage%'`,
      lte(bills.latestDate, sql`NOW()`)
    ))
  return result[0]?.count ?? 0
}

export async function getBillsRoyalAssentByMonth() {
  const result = await db.execute(sql`
    SELECT
      gs.month,
      COALESCE(b.assent_count, 0) as assent_count
    FROM generate_series(
      DATE_TRUNC('month', NOW()) - INTERVAL '11 months',
      DATE_TRUNC('month', NOW()),
      INTERVAL '1 month'
    ) AS gs(month)
    LEFT JOIN (
      SELECT
        DATE_TRUNC('month', royal_assent_date::timestamptz) as month,
        COUNT(*) as assent_count
      FROM bills
      WHERE royal_assent_date IS NOT NULL
        AND royal_assent_date::timestamptz >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
      GROUP BY DATE_TRUNC('month', royal_assent_date::timestamptz)
    ) b ON gs.month = b.month
    ORDER BY gs.month ASC
  `)
  return result.rows as { month: string; assent_count: number }[]
}
