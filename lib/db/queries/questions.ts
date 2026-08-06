import { eq, desc, sql, and } from 'drizzle-orm'
import { db } from '../client'
import { members, questionStats, ministers } from '../schema'
import { CURRENT_MANDATE } from './helpers'

export async function getQuestionStatsByMember(personId: string, mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      year: questionStats.year,
      month: questionStats.month,
      writtenCount: questionStats.writtenCount,
      oralCount: questionStats.oralCount,
    })
    .from(questionStats)
    .where(and(eq(questionStats.personId, personId), eq(questionStats.mandate, mandate)))
    .orderBy(questionStats.year, questionStats.month)
  return rows
}

export async function getQuestionTotalsAllMembers(mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      personId: questionStats.personId,
      total: sql<number>`sum(${questionStats.writtenCount} + ${questionStats.oralCount})`,
      written: sql<number>`sum(${questionStats.writtenCount})`,
      oral: sql<number>`sum(${questionStats.oralCount})`,
    })
    .from(questionStats)
    .where(eq(questionStats.mandate, mandate))
    .groupBy(questionStats.personId)
  return rows
}

export async function getQuestionRankForMember(personId: string, mandate: string = CURRENT_MANDATE): Promise<{ rank: number; totalEligible: number } | null> {
  // Subquery: total questions per eligible MLA (current, no assembly role, not a minister)
  const eligible = db
    .select({
      personId: questionStats.personId,
      total: sql<number>`sum(${questionStats.writtenCount} + ${questionStats.oralCount})`.as('total'),
    })
    .from(questionStats)
    .innerJoin(members, and(eq(questionStats.personId, members.personId), eq(members.mandate, mandate)))
    // Exclude ministers OF THIS MANDATE only — scoping the join to the mandate keeps the
    // archived cohort frozen (a person becoming a minister in a later mandate must not
    // retroactively drop out of this mandate's question ranking).
    .leftJoin(ministers, and(eq(questionStats.personId, ministers.personId), eq(ministers.mandate, mandate)))
    .where(and(
      eq(members.isCurrent, true),
      sql`(${members.assemblyRole} is null OR ${members.assemblyRole} != 'Speaker')`,
      sql`${ministers.personId} is null`,
      eq(questionStats.mandate, mandate),
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

export async function getQuestionStatsByParty(party: string, mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      personId: questionStats.personId,
      year: questionStats.year,
      month: questionStats.month,
      writtenCount: questionStats.writtenCount,
      oralCount: questionStats.oralCount,
    })
    .from(questionStats)
    .innerJoin(members, and(eq(questionStats.personId, members.personId), eq(members.mandate, mandate)))
    .where(and(eq(members.party, party), eq(questionStats.mandate, mandate)))
    .orderBy(questionStats.year, questionStats.month)
  return rows
}

// Must reconcile with getQuestionStatsByParty's total, so no eligibility filtering here.
// Unlike an MLA's own-page rank, this includes ministers and former members too.
export async function getQuestionRankingByParty(party: string, mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      personId: members.personId,
      fullName: members.fullName,
      imgUrl: members.imgUrl,
      constituency: members.constituency,
      isCurrent: members.isCurrent,
      total: sql<number>`sum(${questionStats.writtenCount} + ${questionStats.oralCount})`,
    })
    .from(questionStats)
    .innerJoin(members, and(eq(questionStats.personId, members.personId), eq(members.mandate, mandate)))
    .where(and(
      eq(members.party, party),
      eq(questionStats.mandate, mandate),
    ))
    .groupBy(members.personId, members.fullName, members.imgUrl, members.constituency, members.isCurrent)
    .having(sql`sum(${questionStats.writtenCount} + ${questionStats.oralCount}) > 0`)
    .orderBy(desc(sql`sum(${questionStats.writtenCount} + ${questionStats.oralCount})`))
  return rows
}
