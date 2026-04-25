import { eq, desc, sql, and, count, countDistinct, isNotNull, isNull, gte, lte, asc } from 'drizzle-orm'
import { db } from './client'
import { members, divisions, votes, hansardReports, ministers, committeeChairs, expenses, registeredInterests, bills, billStages, questionStats } from './schema'
import { stripHonorifics } from '@/lib/utils/formatNames'
import { getSurname } from '@/lib/format'

const mlaImg = (personId: string | null | undefined): string | null =>
  personId ? `/mla-images/${personId}.jpg` : null

const CURRENT_MANDATE = '2022-2027'

export async function getAllMlasByConstituency(): Promise<Record<string, { personId: string; fullName: string; party: string; imgUrl: string | null }[]>> {
  const rows = await db
    .select({
      personId: members.personId,
      fullName: members.fullName,
      party: members.party,
      imgUrl: members.imgUrl,
      constituency: members.constituency,
    })
    .from(members)
    .where(and(eq(members.isCurrent, true), isNotNull(members.constituency)))
    .orderBy(asc(members.fullName))
  const map: Record<string, { personId: string; fullName: string; party: string; imgUrl: string | null }[]> = {}
  for (const r of rows) {
    const c = r.constituency!
    if (!map[c]) map[c] = []
    map[c].push({ personId: r.personId, fullName: r.fullName, party: r.party ?? '', imgUrl: mlaImg(r.personId) })
  }
  return map
}

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

export interface PartyMlaExpense {
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
  total: number
  financialYear: string
  period: string
}

export interface PartyExpenseStats {
  financialYear: string
  period: string
  partyTotal: number
  avgPerMla: number
  highestMla: PartyMlaExpense
  lowestMla: PartyMlaExpense
  visitCount: number
  rankTotal: number
  rankAvg: number
  rankVisits: number
  partyCount: number
  mlas: PartyMlaExpense[]
}

export async function getPartyExpenses(party: string): Promise<PartyExpenseStats | null> {
  const [mlaRows, visitRows, rankRows] = await Promise.all([
    db
      .select({
        personId: expenses.personId,
        fullName: members.fullName,
        imgUrl: members.imgUrl,
        constituency: members.constituency,
        total: expenses.total,
        financialYear: expenses.financialYear,
        period: expenses.period,
      })
      .from(expenses)
      .innerJoin(members, eq(expenses.personId, members.personId))
      .where(and(
        eq(expenses.financialYear, '2025-2026'),
        eq(members.mandate, CURRENT_MANDATE),
        eq(members.isCurrent, true),
        eq(members.party, party),
      ))
      .orderBy(desc(expenses.total)),
    db
      .select({ count: count() })
      .from(registeredInterests)
      .innerJoin(members, eq(registeredInterests.personId, members.personId))
      .where(and(
        eq(registeredInterests.registerCategory, 'Visits'),
        eq(members.mandate, CURRENT_MANDATE),
        eq(members.party, party),
      )),
    db.execute(sql`
      SELECT
        m.party,
        RANK() OVER (ORDER BY SUM(e.total) DESC) AS rank_total,
        RANK() OVER (ORDER BY AVG(e.total) DESC) AS rank_avg,
        RANK() OVER (ORDER BY COUNT(DISTINCT ri.id) DESC) AS rank_visits,
        COUNT(*) AS party_count
      FROM expenses e
      JOIN members m ON m.person_id = e.person_id
      LEFT JOIN registered_interests ri
        ON ri.person_id = m.person_id
        AND ri.register_category = 'Visits'
        AND m.mandate = '2022-2027'
      WHERE e.financial_year = '2025-2026'
        AND m.mandate = '2022-2027'
        AND m.is_current = true
      GROUP BY m.party
    `),
  ])

  if (mlaRows.length === 0) return null

  const mlas: PartyMlaExpense[] = mlaRows.map(r => ({
    personId: r.personId,
    fullName: r.fullName,
    imgUrl: mlaImg(r.personId),
    constituency: r.constituency,
    total: parseFloat(r.total as unknown as string),
    financialYear: r.financialYear,
    period: r.period ?? '',
  }))

  const partyTotal = mlas.reduce((sum, m) => sum + m.total, 0)
  const avgPerMla = partyTotal / mlas.length
  const visitCount = Number(visitRows[0]?.count ?? 0)

  type RankRow = { party: string; rank_total: string; rank_avg: string; rank_visits: string; party_count: string }
  const rankData = rankRows.rows as RankRow[]
  const partyCount = rankData.length
  const myRank = rankData.find(r => r.party === party)
  const rankTotal = myRank ? Number(myRank.rank_total) : 0
  const rankAvg = myRank ? Number(myRank.rank_avg) : 0
  const rankVisits = myRank ? Number(myRank.rank_visits) : 0

  return {
    financialYear: mlas[0].financialYear,
    period: mlas[0].period,
    partyTotal,
    avgPerMla,
    highestMla: mlas[0],
    lowestMla: mlas[mlas.length - 1],
    visitCount,
    rankTotal,
    rankAvg,
    rankVisits,
    partyCount,
    mlas,
  }
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
    GROUP BY b.bill_id, b.short_title, b.long_title, b.bill_type, b.is_accelerated, b.current_stage, b.latest_date, b.royal_assent_date, b.act_title, fs_plain.has_division, d.outcome, fs_plain.plenary_date
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

export async function getBillsPassedPerMonth() {
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
      WHERE royal_assent_date >= '2022-05-01'
      GROUP BY DATE_TRUNC('month', royal_assent_date)
    ) b ON gs.month = b.month
    ORDER BY gs.month ASC
  `)
  return result.rows as { month: string; bills_passed: number }[]
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

export async function getBillsProgressedThisWeek(): Promise<{
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
    WHERE bs.plenary_date >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
      AND bs.plenary_date <= NOW()
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
      WHERE plenary_date >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
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

export async function getThisWeekPlenaryItems(): Promise<{ document_id: string; title: string; plenary_date: string; plenary_type: string; plenary_type_id: string; motion_category: string | null; text: string | null }[]> {
  const [piResult, bsResult] = await Promise.all([
    db.execute(sql`
      SELECT
        document_id,
        title,
        plenary_date::text,
        plenary_type,
        plenary_type_id,
        motion_category,
        text
      FROM plenary_items
      WHERE plenary_date >= date_trunc('week', CURRENT_DATE)
        AND plenary_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
        AND plenary_type_id != '2'
    `),
    db.execute(sql`
      SELECT DISTINCT ON (bs.bill_id, bs.plenary_date::date)
        bs.document_id,
        bs.stage || ': ' || b.short_title || ' (' || b.bill_id || ')' AS title,
        bs.plenary_date::date::text AS plenary_date,
        'Motion' AS plenary_type,
        '1' AS plenary_type_id,
        NULL::text AS motion_category,
        NULL::text AS text
      FROM bill_stages bs
      JOIN bills b ON bs.bill_id = b.bill_id
      WHERE bs.plenary_date::date >= date_trunc('week', CURRENT_DATE)
        AND bs.plenary_date::date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
        AND (
          bs.item_title IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM bill_stages bs2
            WHERE bs2.bill_id = bs.bill_id
              AND bs2.stage = bs.stage
              AND bs2.plenary_date::date = bs.plenary_date::date
              AND bs2.item_title IS NULL
          )
        )
      ORDER BY bs.bill_id, bs.plenary_date::date, bs.plenary_date DESC
    `),
  ])

  type Row = { document_id: string; title: string; plenary_date: string; plenary_type: string; plenary_type_id: string; motion_category: string | null; text: string | null }

  const piRows = piResult.rows as Row[]
  const bsRows = bsResult.rows as Row[]

  // Deduplicate by (title, plenary_date) — prefer plenary_items
  const seen = new Set(piRows.map(r => `${r.plenary_date}||${r.title}`))
  const merged = [
    ...piRows,
    ...bsRows.filter(r => !seen.has(`${r.plenary_date}||${r.title}`)),
  ]

  merged.sort((a, b) => a.plenary_date.localeCompare(b.plenary_date) || a.title.localeCompare(b.title))

  return merged
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
      lte(bills.latestDate, sql`NOW()`)
    ))
    .orderBy(desc(bills.latestDate))
    .limit(limit)
}

export interface PartyStats {
  party: string
  slug: string
  mlaCount: number
  ministers: { fullName: string; personId: string; imgUrl: string | null; roleTitle: string | null; department: string | null }[] | null
  committeeChairs: { fullName: string; personId: string; imgUrl: string | null; committeeName: string }[] | null
  mlas: { personId: string; fullName: string; imgUrl: string | null; constituency: string | null } [] | null
}

export interface PartyDetail extends PartyStats {
  mlas: { personId: string; fullName: string; imgUrl: string | null; constituency: string | null; assemblyRole: string | null; assemblyRoleEnd: string | null }[]
}

function makePartySlug(party: string): string {
  return party
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export async function getAllPartiesWithStats(): Promise<PartyStats[]> {
  const result = await db.execute(sql`
    SELECT
      m.party,
      COUNT(DISTINCT m.person_id) AS mla_count,
      json_agg(
        json_build_object(
          'fullName', mi_m.full_name,
          'personId', mi_m.person_id,
          'imgUrl', mi_m.img_url,
          'roleTitle', mi.role_title,
          'department', mi.department
        ) ORDER BY mi_m.full_name
      ) FILTER (WHERE mi.person_id IS NOT NULL) AS ministers,
      json_agg(
        json_build_object(
          'fullName', cc_m.full_name,
          'personId', cc_m.person_id,
          'imgUrl', cc_m.img_url,
          'committeeName', cc.committee_name
        ) ORDER BY cc_m.full_name
      ) FILTER (WHERE cc.person_id IS NOT NULL) AS committee_chairs,
      json_agg(
        json_build_object(
          'fullName', m.full_name,
          'personId', m.person_id,
          'constituency', m.constituency
        ) ORDER BY m.full_name
      ) AS mlas
    FROM members m
    LEFT JOIN ministers mi ON mi.person_id = m.person_id
    LEFT JOIN members mi_m ON mi_m.person_id = mi.person_id
    LEFT JOIN committee_chairs cc ON cc.person_id = m.person_id
    LEFT JOIN members cc_m ON cc_m.person_id = cc.person_id
    WHERE m.is_current = true
    AND m.mandate = '2022-2027'
    GROUP BY m.party
    ORDER BY
      CASE WHEN m.party = 'Independent' THEN 1 ELSE 0 END ASC,
      COUNT(DISTINCT m.person_id) DESC
  `)

  type RawRow = {
    party: string
    mla_count: string | number
    ministers: unknown
    committee_chairs: unknown
    mlas: unknown
  }

  return (result.rows as RawRow[]).map((row) => {
    const parseJson = (val: unknown): unknown[] | null => {
      if (!val) return null
      if (Array.isArray(val)) return val
      if (typeof val === 'string') {
        try { return JSON.parse(val) } catch { return null }
      }
      return null
    }

    const rawMins = parseJson(row.ministers) as { fullName: string; personId: string; imgUrl: string | null; roleTitle: string | null; department: string | null }[] | null
    const rawChairs = parseJson(row.committee_chairs) as { fullName: string; personId: string; imgUrl: string | null; committeeName: string }[] | null
    const rawMlas = parseJson(row.mlas) as { fullName: string; personId: string; constituency: string | null }[] | null

    return {
      party: row.party,
      slug: makePartySlug(row.party),
      mlaCount: Number(row.mla_count),
      ministers: rawMins ? rawMins.map(m => ({ ...m, imgUrl: mlaImg(m.personId) })) : null,
      committeeChairs: rawChairs ? rawChairs.map(c => ({ ...c, imgUrl: mlaImg(c.personId) })) : null,
      mlas: rawMlas ? rawMlas.map(m => ({ ...m, imgUrl: mlaImg(m.personId) })) : null,
    }
  })
}

export async function getPartyBySlug(slug: string): Promise<PartyDetail | null> {
  const all = await getAllPartiesWithStats()
  const match = all.find((p) => p.slug === slug)
  if (!match) return null

  const mlasResult = await db.execute(sql`
    SELECT
      person_id, full_name, img_url, constituency,
      assembly_role, assembly_role_end
    FROM members
    WHERE is_current = true
    AND mandate = '2022-2027'
    AND party = ${match.party}
    ORDER BY SPLIT_PART(REGEXP_REPLACE(full_name, '^(Mr|Mrs|Miss|Ms|Dr|Lord|Lady|Sir)\s+', '', 'i'), ' ', -1) ASC
  `)

  type MlaRow = { person_id: string; full_name: string; img_url: string | null; constituency: string | null; assembly_role: string | null; assembly_role_end: string | null }

  const mlas = (mlasResult.rows as MlaRow[]).map((r) => ({
    personId: r.person_id,
    fullName: r.full_name,
    imgUrl: mlaImg(r.person_id),
    constituency: r.constituency,
    assemblyRole: r.assembly_role,
    assemblyRoleEnd: r.assembly_role_end,
  }))

  return { ...match, mlas }
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

export interface MlaAttendanceStat {
  personId: string
  fullName: string
  attendancePct: number
  present: number
  total: number
  imgUrl: string | null
  constituency: string | null
}

export interface PartyVoteStats {
  aye: number
  no: number
  abstained: number
  noShow: number
  attendancePct: number
  present: number
  total: number
  highestMla: MlaAttendanceStat
  lowestMla: MlaAttendanceStat
  trend: { month: string; attendancePct: number }[]
  recentDivisions: {
    documentId: string
    subject: string
    title: string | null
    divisionDate: string
    outcome: string | null
    partyVote: string | null
  }[]
}

export async function getPartyAssemblyStats(party: string): Promise<PartyVoteStats> {
  const [votesResult, mlaResult, trendResult, divisionsResult] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(CASE WHEN v.vote = 'AYE' THEN 1 END) as aye,
        COUNT(CASE WHEN v.vote = 'NO' THEN 1 END) as no,
        COUNT(CASE WHEN v.vote = 'ABSTAINED' THEN 1 END) as abstained,
        COUNT(CASE WHEN v.vote = 'NO_SHOW' THEN 1 END) as no_show,
        COUNT(DISTINCT CASE WHEN v.vote != 'NO_SHOW' THEN v.document_id END) as present,
        COUNT(DISTINCT v.document_id) as total,
        ROUND(
          COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) * 100.0 /
          NULLIF(COUNT(*), 0), 1
        ) as attendance_pct
      FROM votes v
      JOIN members m ON m.person_id = v.person_id
      WHERE m.mandate = '2022-2027'
      AND m.party = ${party}
    `),
    db.execute(sql`
      SELECT person_id, full_name, attendance_pct, present, total, constituency
      FROM (
        SELECT
          m.person_id, m.full_name, m.constituency,
          COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) as present,
          COUNT(*) as total,
          ROUND(
            COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) * 100.0 /
            NULLIF(COUNT(*), 0), 1
          ) as attendance_pct,
          ROW_NUMBER() OVER (
            ORDER BY COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) * 100.0 /
            NULLIF(COUNT(*), 0) DESC
          ) as rnk_high,
          ROW_NUMBER() OVER (
            ORDER BY COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) * 100.0 /
            NULLIF(COUNT(*), 0) ASC
          ) as rnk_low
        FROM votes v
        JOIN members m ON m.person_id = v.person_id
        WHERE m.mandate = '2022-2027'
        AND m.party = ${party}
        AND m.is_current = true
        AND (m.assembly_role IS NULL OR m.assembly_role NOT ILIKE '%speaker%')
        AND NOT EXISTS (
          SELECT 1 FROM ministers mi
          WHERE mi.person_id = m.person_id
          AND (mi.role_title ILIKE '%First Minister%' OR mi.role_title ILIKE '%deputy First Minister%')
        )
        GROUP BY m.person_id, m.full_name, m.constituency
      ) sub
      WHERE rnk_high = 1 OR rnk_low = 1
    `),
    db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', d.division_date), 'Mon YYYY') as month,
        DATE_TRUNC('month', d.division_date) as month_date,
        ROUND(
          COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) * 100.0 /
          NULLIF(COUNT(*), 0), 1
        ) as attendance_pct
      FROM votes v
      JOIN members m ON m.person_id = v.person_id
      JOIN divisions d ON d.document_id = v.document_id
      WHERE m.mandate = '2022-2027'
      AND m.party = ${party}
      GROUP BY DATE_TRUNC('month', d.division_date)
      ORDER BY month_date ASC
    `),
    db.execute(sql`
      SELECT document_id, subject, title, division_date, outcome, party_vote
      FROM (
        SELECT DISTINCT
          d.document_id,
          d.subject,
          d.title,
          d.division_date::text as division_date,
          d.outcome,
          d.division_date as sort_date,
          (
            SELECT v2.vote
            FROM votes v2
            JOIN members m2 ON m2.person_id = v2.person_id
            WHERE v2.document_id = d.document_id
            AND m2.party = ${party}
            AND m2.mandate = '2022-2027'
            GROUP BY v2.vote
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as party_vote
        FROM divisions d
        JOIN votes v ON v.document_id = d.document_id
        JOIN members m ON m.person_id = v.person_id
        WHERE m.party = ${party}
        AND m.mandate = '2022-2027'
      ) sub
      ORDER BY sort_date DESC
      LIMIT 5
    `),
  ])

  type VoteRow = { aye: string; no: string; abstained: string; no_show: string; attendance_pct: string }
  type MlaRow = { person_id: string; full_name: string; attendance_pct: string; present: string; total: string; constituency: string | null }
  type TrendRow = { month: string; attendance_pct: string }
  type DivRow = { document_id: string; subject: string; title: string | null; division_date: string; outcome: string | null; party_vote: string | null }

  type VoteRowFull = VoteRow & { present: string; total: string }
  const vr = votesResult.rows[0] as VoteRowFull
  const mlaRows = mlaResult.rows as MlaRow[]
  const trendRows = trendResult.rows as TrendRow[]
  const divRows = divisionsResult.rows as DivRow[]

  const sorted = [...mlaRows].sort((a, b) => parseFloat(b.attendance_pct) - parseFloat(a.attendance_pct))
  const toStat = (r: MlaRow): MlaAttendanceStat => ({
    personId: r.person_id,
    fullName: r.full_name,
    attendancePct: parseFloat(r.attendance_pct),
    present: parseInt(r.present),
    total: parseInt(r.total),
    imgUrl: mlaImg(r.person_id),
    constituency: r.constituency,
  })
  const highestMla: MlaAttendanceStat = sorted[0]
    ? toStat(sorted[0])
    : { personId: '', fullName: '', attendancePct: 0, present: 0, total: 0, imgUrl: null, constituency: null }
  const lowestMla: MlaAttendanceStat = sorted[sorted.length - 1]
    ? toStat(sorted[sorted.length - 1])
    : highestMla

  return {
    aye: parseInt(vr?.aye ?? '0'),
    no: parseInt(vr?.no ?? '0'),
    abstained: parseInt(vr?.abstained ?? '0'),
    noShow: parseInt(vr?.no_show ?? '0'),
    attendancePct: parseFloat(vr?.attendance_pct ?? '0'),
    present: parseInt(vr?.present ?? '0'),
    total: parseInt(vr?.total ?? '0'),
    highestMla,
    lowestMla,
    trend: trendRows.map((r) => ({ month: r.month, attendancePct: parseFloat(r.attendance_pct) })),
    recentDivisions: divRows.map((r) => ({
      documentId: r.document_id,
      subject: r.subject,
      title: r.title,
      divisionDate: r.division_date,
      outcome: r.outcome,
      partyVote: r.party_vote,
    })),
  }
}

export async function getQuestionStatsByMember(personId: string) {
  const rows = await db
    .select({
      year: questionStats.year,
      month: questionStats.month,
      writtenCount: questionStats.writtenCount,
      oralCount: questionStats.oralCount,
    })
    .from(questionStats)
    .where(eq(questionStats.personId, personId))
    .orderBy(questionStats.year, questionStats.month)
  return rows
}

export async function getQuestionTotalsAllMembers() {
  const rows = await db
    .select({
      personId: questionStats.personId,
      total: sql<number>`sum(${questionStats.writtenCount} + ${questionStats.oralCount})`,
      written: sql<number>`sum(${questionStats.writtenCount})`,
      oral: sql<number>`sum(${questionStats.oralCount})`,
    })
    .from(questionStats)
    .groupBy(questionStats.personId)
  return rows
}

export async function getQuestionRankForMember(personId: string): Promise<{ rank: number; totalEligible: number } | null> {
  // Subquery: total questions per eligible MLA (current, no assembly role, not a minister)
  const eligible = db
    .select({
      personId: questionStats.personId,
      total: sql<number>`sum(${questionStats.writtenCount} + ${questionStats.oralCount})`.as('total'),
    })
    .from(questionStats)
    .innerJoin(members, eq(questionStats.personId, members.personId))
    .leftJoin(ministers, eq(questionStats.personId, ministers.personId))
    .where(and(
      eq(members.isCurrent, true),
      sql`${members.assemblyRole} is null`,
      sql`${ministers.personId} is null`,
    ))
    .groupBy(questionStats.personId)
    .as('eligible')

  const myTotalRows = await db
    .select({ total: eligible.total })
    .from(eligible)
    .where(eq(eligible.personId, personId))

  const myTotal = Number(myTotalRows[0]?.total ?? 0)
  if (myTotal === 0) return null

  const [rankRow, countRow] = await Promise.all([
    db.select({ rank: sql<number>`count(*) + 1` }).from(eligible).where(sql`${eligible.total} > ${myTotal}`),
    db.select({ count: sql<number>`count(*)` }).from(eligible),
  ])

  return {
    rank: Number(rankRow[0]?.rank ?? 1),
    totalEligible: Number(countRow[0]?.count ?? 0),
  }
}

export async function getQuestionStatsByParty(party: string) {
  const rows = await db
    .select({
      personId: questionStats.personId,
      year: questionStats.year,
      month: questionStats.month,
      writtenCount: questionStats.writtenCount,
      oralCount: questionStats.oralCount,
    })
    .from(questionStats)
    .innerJoin(members, eq(questionStats.personId, members.personId))
    .where(eq(members.party, party))
    .orderBy(questionStats.year, questionStats.month)
  return rows
}
