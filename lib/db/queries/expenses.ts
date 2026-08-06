import { eq, sql, and, count, desc } from 'drizzle-orm'
import { db } from '../client'
import { members, expenses, registeredInterests } from '../schema'
import { CURRENT_MANDATE, mlaImg } from './helpers'

export async function getTotalExpensesPerMember(mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    SELECT person_id as "personId", SUM(total) as "totalExpenses"
    FROM expenses
    WHERE total IS NOT NULL
    AND mandate = ${mandate}
    GROUP BY person_id
  `)
  return result.rows as { personId: string; totalExpenses: string }[]
}

export async function getAllExpensesLeagueTable(mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    SELECT
      e.person_id as "personId",
      m.full_name as "fullName",
      m.party,
      m.constituency,
      m.img_url as "imgUrl",
      m.mandate_start as "mandateStart",
      e.total,
      e.financial_year as "financialYear",
      e.period
    FROM expenses e
    INNER JOIN members m ON m.person_id = e.person_id AND m.mandate = ${mandate}
    WHERE m.is_current = true
    AND e.mandate = ${mandate}
    ORDER BY e.financial_year DESC, e.total DESC NULLS LAST
  `)
  type LeagueRow = { personId: string; fullName: string; party: string | null; constituency: string | null; imgUrl: string | null; mandateStart: string | null; total: string | null; financialYear: string; period: string | null }
  return (result.rows as LeagueRow[]).map(r => ({ ...r, imgUrl: `/mla-images/${r.personId}.jpg` }))
}

export async function getExpensesLeagueTable(mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    WITH latest_year AS (
      SELECT financial_year FROM expenses WHERE mandate = ${mandate} ORDER BY financial_year DESC LIMIT 1
    )
    SELECT
      e.person_id as "personId",
      m.full_name as "fullName",
      m.party,
      m.constituency,
      m.img_url as "imgUrl",
      m.mandate_start as "mandateStart",
      e.total,
      e.staff_costs as "staffCosts",
      e.constituency_office as "constituencyOffice",
      e.allowances,
      e.other_expenses as "otherExpenses",
      e.financial_year as "financialYear",
      e.period
    FROM expenses e
    INNER JOIN members m ON m.person_id = e.person_id AND m.mandate = ${mandate}
    WHERE m.is_current = true
      AND e.mandate = ${mandate}
      AND e.financial_year = (SELECT financial_year FROM latest_year)
    ORDER BY e.total DESC
  `)
  type LeagueLatestRow = { personId: string; fullName: string; party: string | null; constituency: string | null; imgUrl: string | null; mandateStart: string | null; total: string | null; staffCosts: string | null; constituencyOffice: string | null; allowances: string | null; otherExpenses: string | null; financialYear: string; period: string | null }
  return (result.rows as LeagueLatestRow[]).map(r => ({ ...r, imgUrl: mlaImg(r.personId) }))
}

export async function getMlasWithoutExpenses(mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    SELECT m.person_id, m.full_name, m.party, m.constituency, m.img_url, m.mandate_start
    FROM members m
    LEFT JOIN expenses e ON e.person_id = m.person_id AND e.mandate = ${mandate}
    WHERE m.is_current = true
      AND e.person_id IS NULL
      AND m.mandate = ${mandate}
    ORDER BY m.full_name
  `)
  return (result.rows as { person_id: string; full_name: string; party: string | null; constituency: string | null; img_url: string | null; mandate_start: string | null }[])
    .map(row => ({ ...row, img_url: mlaImg(row.person_id) }))
}

interface PartyMlaExpense {
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
  total: number
  financialYear: string
  period: string
  isCurrent: boolean
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

export async function getPartyMandateExpenses(party: string, mandate: string = CURRENT_MANDATE): Promise<{ mandateTotal: number; mandateAvgPerMla: number; mlaCount: number; rankTotal: number; rankAvg: number; partyCount: number } | null> {
  const result = await db.execute(sql`
    WITH party_totals AS (
      SELECT
        m.party,
        COALESCE(SUM(e.total), 0) as mandate_total,
        COUNT(DISTINCT e.person_id) as mla_count
      FROM expenses e
      JOIN members m ON m.person_id = e.person_id AND m.mandate = ${mandate}
      WHERE e.total IS NOT NULL
        AND e.mandate = ${mandate}
      GROUP BY m.party
    ),
    ranked AS (
      SELECT
        party,
        mandate_total,
        mla_count,
        CASE WHEN mla_count > 0 THEN mandate_total / mla_count ELSE 0 END as avg_per_mla,
        RANK() OVER (ORDER BY mandate_total DESC) as rank_total,
        RANK() OVER (ORDER BY CASE WHEN mla_count > 0 THEN mandate_total / mla_count ELSE 0 END DESC) as rank_avg,
        COUNT(*) OVER () as party_count
      FROM party_totals
    )
    SELECT mandate_total, mla_count, avg_per_mla, rank_total, rank_avg, party_count
    FROM ranked
    WHERE party = ${party}
  `)
  const row = result.rows[0] as { mandate_total: string; mla_count: string; avg_per_mla: string; rank_total: string; rank_avg: string; party_count: string } | undefined
  if (!row) return null
  return {
    mandateTotal: Number(row.mandate_total),
    mandateAvgPerMla: Number(row.avg_per_mla),
    mlaCount: Number(row.mla_count),
    rankTotal: Number(row.rank_total),
    rankAvg: Number(row.rank_avg),
    partyCount: Number(row.party_count),
  }
}

export async function getPartyExpenses(party: string, mandate: string = CURRENT_MANDATE): Promise<PartyExpenseStats | null> {
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
        isCurrent: members.isCurrent,
      })
      .from(expenses)
      .innerJoin(members, eq(expenses.personId, members.personId))
      .where(and(
        sql`${expenses.financialYear} = (SELECT MAX(financial_year) FROM expenses WHERE mandate = ${mandate})`,
        eq(expenses.mandate, mandate),
        eq(members.mandate, mandate),
        eq(members.party, party),
      ))
      .orderBy(desc(expenses.total)),
    db
      .select({ count: count() })
      .from(registeredInterests)
      .innerJoin(members, eq(registeredInterests.personId, members.personId))
      .where(and(
        eq(registeredInterests.registerCategory, 'Visits'),
        eq(registeredInterests.mandate, mandate),
        eq(members.mandate, mandate),
        eq(members.party, party),
      )),
    // Ranks include negative totals (net recoveries), matching partyTotal/avgPerMla above,
    // so a party's rank position always matches the net figure it's labeling.
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
        AND ri.mandate = ${mandate}
      WHERE e.financial_year = (SELECT MAX(financial_year) FROM expenses WHERE mandate = ${mandate})
        AND e.mandate = ${mandate}
        AND m.mandate = ${mandate}
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
    isCurrent: r.isCurrent,
  }))

  const visitCount = Number(visitRows[0]?.count ?? 0)

  // partyTotal/avgPerMla are net figures — they include negative totals (net recoveries/
  // corrections from a former MLA), so "Total expenses" reflects what the party actually
  // cost that year. Those negative rows are still excluded from the ranked list and
  // highest/lowest, though, since ranking a recovery as a "low claim" would be meaningless —
  // so the total can differ from the sum of the visible list by exactly the recovered amount.
  const claimedMlas = mlas.filter(m => m.total >= 0)
  const partyTotal = mlas.reduce((sum, m) => sum + m.total, 0)
  const avgPerMla = mlas.length > 0 ? partyTotal / mlas.length : 0
  const highestMla = claimedMlas[0] ?? mlas[0]
  const lowestMla = claimedMlas[claimedMlas.length - 1] ?? mlas[mlas.length - 1]

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
    highestMla,
    lowestMla,
    visitCount,
    rankTotal,
    rankAvg,
    rankVisits,
    partyCount,
    mlas: claimedMlas,
  }
}

export async function getAllMemberExpenses(personId: string, mandate: string = CURRENT_MANDATE) {
  const rows = await db.execute(sql`
    WITH year_ranks AS (
      SELECT
        person_id,
        financial_year,
        total,
        RANK() OVER (PARTITION BY financial_year ORDER BY total DESC) as rank,
        COUNT(*) OVER (PARTITION BY financial_year) as total_members
      FROM expenses
      WHERE mandate = ${mandate}
        AND total >= 0
    )
    SELECT
      e.financial_year,
      e.period,
      e.constituency_office,
      e.other_expenses,
      e.allowances,
      e.staff_costs,
      e.total,
      yr.rank,
      yr.total_members
    FROM expenses e
    LEFT JOIN year_ranks yr ON yr.person_id = e.person_id AND yr.financial_year = e.financial_year
    WHERE e.person_id = ${personId}
      AND e.mandate = ${mandate}
    ORDER BY e.financial_year DESC
  `)
  return rows.rows
}

export async function getMandateExpensesRank(personId: string, mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    WITH totals AS (
      SELECT person_id, SUM(total) as mandate_total
      FROM expenses
      WHERE mandate = ${mandate}
      GROUP BY person_id
    ),
    ranked AS (
      SELECT
        person_id,
        RANK() OVER (ORDER BY mandate_total DESC) as rank,
        COUNT(*) OVER () as total_members
      FROM totals
    )
    SELECT rank, total_members FROM ranked WHERE person_id = ${personId}
  `)
  return result.rows[0] ?? null
}

export async function getRegisteredInterestsByMember(personId: string, mandate: string = CURRENT_MANDATE) {
  return db
    .select()
    .from(registeredInterests)
    .where(and(eq(registeredInterests.personId, personId), eq(registeredInterests.mandate, mandate)))
    .orderBy(registeredInterests.registerCategoryId, registeredInterests.registerEntryStartDate)
}

export async function getExpensesByParty(mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    SELECT
      m.party,
      SUM(e.total) as party_total,
      COUNT(DISTINCT e.person_id) as mla_count,
      SUM(e.total) / COUNT(DISTINCT e.person_id) as per_mla_avg
    FROM expenses e
    JOIN members m ON e.person_id = m.person_id AND m.mandate = ${mandate}
    WHERE e.mandate = ${mandate}
      AND e.financial_year = (SELECT MAX(financial_year) FROM expenses WHERE mandate = ${mandate})
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

export async function getLatestExpensesYear(mandate: string = CURRENT_MANDATE): Promise<string> {
  const result = await db.execute(sql`SELECT MAX(financial_year) as latest FROM expenses WHERE mandate = ${mandate}`)
  return String(result.rows[0]?.latest ?? '')
}

// Sum of every MLA expense claim (current and former members) for the latest published
// year, alongside the count claims are averaged over. Unlike getExpensesLeagueTable this
// is not filtered to is_current — it's the true total of individual claims that year.
export async function getAllMlaExpensesForLatestYear(mandate: string = CURRENT_MANDATE): Promise<{ total: number; count: number; financialYear: string }> {
  const result = await db.execute(sql`
    WITH latest_year AS (
      SELECT financial_year FROM expenses WHERE mandate = ${mandate} ORDER BY financial_year DESC LIMIT 1
    )
    SELECT
      COALESCE(SUM(e.total), 0) as total,
      COUNT(*) as count,
      (SELECT financial_year FROM latest_year) as "financialYear"
    FROM expenses e
    INNER JOIN members m ON m.person_id = e.person_id AND m.mandate = ${mandate}
    WHERE e.mandate = ${mandate}
      AND e.financial_year = (SELECT financial_year FROM latest_year)
  `)
  const row = result.rows[0] as { total: string; count: string; financialYear: string } | undefined
  return {
    total: Number(row?.total ?? 0),
    count: Number(row?.count ?? 0),
    financialYear: row?.financialYear ?? '',
  }
}

// Assembly-wide expense line items not attributable to an individual MLA
// (e.g. "Disability & Security Measures Costs") for the latest published year.
export async function getInstitutionalExpensesForLatestYear(mandate: string = CURRENT_MANDATE): Promise<{ category: string; amount: number }[]> {
  const result = await db.execute(sql`
    WITH latest_year AS (
      SELECT financial_year FROM expenses WHERE mandate = ${mandate} ORDER BY financial_year DESC LIMIT 1
    )
    SELECT category, amount
    FROM institutional_expenses
    WHERE mandate = ${mandate}
      AND financial_year = (SELECT financial_year FROM latest_year)
    ORDER BY amount DESC
  `)
  return (result.rows as { category: string; amount: string }[]).map(r => ({ category: r.category, amount: Number(r.amount) }))
}
