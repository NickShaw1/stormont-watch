import { eq, desc, sql, and, isNull, asc } from 'drizzle-orm'
import { db } from '../client'
import { members, hansardReports, hansardContributions } from '../schema'
import { CURRENT_MANDATE, mandateStartOf } from './helpers'

export async function getHansardStatsByMember(personId: string, mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      reportDocId: hansardContributions.reportDocId,
      plenaryDate: hansardContributions.plenaryDate,
      debateTitle: hansardContributions.debateTitle,
    })
    .from(hansardContributions)
    .where(and(eq(hansardContributions.personId, personId), eq(hansardContributions.mandate, mandate)))
    .orderBy(desc(hansardContributions.plenaryDate))
  return rows
}

export async function getHansardRankForMember(personId: string, mandate: string = CURRENT_MANDATE): Promise<{ rank: number; eligibleCount: number; sittings: number } | null> {
  const eligible = db
    .select({
      personId: hansardContributions.personId,
      sittings: sql<number>`count(distinct ${hansardContributions.reportDocId})`.as('sittings'),
    })
    .from(hansardContributions)
    .innerJoin(members, and(eq(hansardContributions.personId, members.personId), eq(members.mandate, mandate)))
    .where(and(
      eq(members.isCurrent, true),
      isNull(members.assemblyRole),
      eq(hansardContributions.mandate, mandate),
    ))
    .groupBy(hansardContributions.personId)
    .as('eligible')

  const mySittingsRows = await db
    .select({ sittings: eligible.sittings })
    .from(eligible)
    .where(eq(eligible.personId, personId))

  const sittings = Number(mySittingsRows[0]?.sittings ?? 0)
  if (sittings === 0) return null

  const [rankRow, countRow] = await Promise.all([
    db.select({ rank: sql<number>`count(*) + 1` }).from(eligible).where(sql`${eligible.sittings} > ${sittings}`),
    db.select({ count: sql<number>`count(*)` }).from(eligible),
  ])

  return {
    rank: Number(rankRow[0]?.rank ?? 1),
    eligibleCount: Number(countRow[0]?.count ?? 0),
    sittings,
  }
}

export async function getHansardDebateRankForMember(personId: string, mandate: string = CURRENT_MANDATE): Promise<{ rank: number; eligibleCount: number; debates: number } | null> {
  const eligible = db
    .select({
      personId: hansardContributions.personId,
      debates: sql<number>`count(distinct ${hansardContributions.debateTitle})`.as('debates'),
    })
    .from(hansardContributions)
    .innerJoin(members, and(eq(hansardContributions.personId, members.personId), eq(members.mandate, mandate)))
    .where(and(
      eq(members.isCurrent, true),
      isNull(members.assemblyRole),
      eq(hansardContributions.mandate, mandate),
    ))
    .groupBy(hansardContributions.personId)
    .as('eligible')

  const myDebatesRows = await db
    .select({ debates: eligible.debates })
    .from(eligible)
    .where(eq(eligible.personId, personId))

  const debates = Number(myDebatesRows[0]?.debates ?? 0)
  if (debates === 0) return null

  const [rankRow, countRow] = await Promise.all([
    db.select({ rank: sql<number>`count(*) + 1` }).from(eligible).where(sql`${eligible.debates} > ${debates}`),
    db.select({ count: sql<number>`count(*)` }).from(eligible),
  ])

  return {
    rank: Number(rankRow[0]?.rank ?? 1),
    eligibleCount: Number(countRow[0]?.count ?? 0),
    debates,
  }
}

export async function getHansardStatsByParty(party: string, mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      personId: hansardContributions.personId,
      fullName: members.fullName,
      constituency: members.constituency,
      imgUrl: members.imgUrl,
      sittings: sql<number>`count(distinct ${hansardContributions.reportDocId})`,
      debates: sql<number>`count(distinct ${hansardContributions.debateTitle})`,
    })
    .from(hansardContributions)
    .innerJoin(members, and(eq(hansardContributions.personId, members.personId), eq(members.mandate, mandate)))
    // assembly_role only ever holds a presiding-officer title (Speaker/Deputy Speaker/
    // Principal Deputy Speaker), so excluding it here matches getHansardPartyRank/
    // getHansardPartyDebateRank and the "presiding officers are excluded" caption on the page.
    .where(and(eq(members.party, party), eq(members.isCurrent, true), isNull(members.assemblyRole), eq(hansardContributions.mandate, mandate)))
    .groupBy(hansardContributions.personId, members.fullName, members.constituency, members.imgUrl)
    .orderBy(desc(sql`count(distinct ${hansardContributions.reportDocId})`))
  return rows
}

export async function getHansardPartyRank(party: string, mandate: string = CURRENT_MANDATE): Promise<{ rank: number; totalParties: number; avgSittings: number } | null> {
  const memberSittings = db
    .select({
      party: members.party,
      personId: members.personId,
      sittings: sql<number>`count(distinct ${hansardContributions.reportDocId})`.as('sittings'),
    })
    .from(members)
    .leftJoin(hansardContributions, and(eq(hansardContributions.personId, members.personId), eq(hansardContributions.mandate, mandate)))
    .where(and(eq(members.isCurrent, true), isNull(members.assemblyRole), eq(members.mandate, mandate)))
    .groupBy(members.party, members.personId)
    .as('member_sittings')

  const partyAvgs = db
    .select({
      party: memberSittings.party,
      avgSittings: sql<number>`avg(${memberSittings.sittings})`.as('avg_sittings'),
    })
    .from(memberSittings)
    .groupBy(memberSittings.party)
    .as('party_avgs')

  const myAvgRows = await db
    .select({ avgSittings: partyAvgs.avgSittings })
    .from(partyAvgs)
    .where(eq(partyAvgs.party, party))

  const avgSittings = Number(myAvgRows[0]?.avgSittings ?? 0)
  if (!myAvgRows.length) return null

  const [rankRow, countRow] = await Promise.all([
    db.select({ rank: sql<number>`count(*) + 1` }).from(partyAvgs).where(sql`${partyAvgs.avgSittings} > ${avgSittings}`),
    db.select({ count: sql<number>`count(*)` }).from(partyAvgs),
  ])

  return {
    rank: Number(rankRow[0]?.rank ?? 1),
    totalParties: Number(countRow[0]?.count ?? 0),
    avgSittings,
  }
}

export async function getHansardPartyDebateRank(party: string, mandate: string = CURRENT_MANDATE): Promise<{ rank: number; totalParties: number; avgDebates: number } | null> {
  const memberDebates = db
    .select({
      party: members.party,
      personId: members.personId,
      debates: sql<number>`count(distinct ${hansardContributions.debateTitle})`.as('debates'),
    })
    .from(members)
    .leftJoin(hansardContributions, and(eq(hansardContributions.personId, members.personId), eq(hansardContributions.mandate, mandate)))
    .where(and(eq(members.isCurrent, true), isNull(members.assemblyRole), eq(members.mandate, mandate)))
    .groupBy(members.party, members.personId)
    .as('member_debates')

  const partyAvgs = db
    .select({
      party: memberDebates.party,
      avgDebates: sql<number>`avg(${memberDebates.debates})`.as('avg_debates'),
    })
    .from(memberDebates)
    .groupBy(memberDebates.party)
    .as('party_avgs')

  const myAvgRows = await db
    .select({ avgDebates: partyAvgs.avgDebates })
    .from(partyAvgs)
    .where(eq(partyAvgs.party, party))

  const avgDebates = Number(myAvgRows[0]?.avgDebates ?? 0)
  if (!myAvgRows.length) return null

  const [rankRow, countRow] = await Promise.all([
    db.select({ rank: sql<number>`count(*) + 1` }).from(partyAvgs).where(sql`${partyAvgs.avgDebates} > ${avgDebates}`),
    db.select({ count: sql<number>`count(*)` }).from(partyAvgs),
  ])

  return {
    rank: Number(rankRow[0]?.rank ?? 1),
    totalParties: Number(countRow[0]?.count ?? 0),
    avgDebates,
  }
}

export async function getHansardSittingsByMonthForParty(party: string, mandateStart: string, mandate: string = CURRENT_MANDATE) {
  const today = new Date().toISOString().slice(0, 10)
  const rows = await db
    .select({
      year: sql<number>`extract(year from ${hansardContributions.plenaryDate})`,
      month: sql<number>`extract(month from ${hansardContributions.plenaryDate})`,
      totalSittings: sql<number>`count(distinct (${hansardContributions.personId}, ${hansardContributions.reportDocId}))`,
    })
    .from(hansardContributions)
    .innerJoin(members, and(eq(hansardContributions.personId, members.personId), eq(members.mandate, mandate)))
    .where(and(
      eq(members.party, party),
      eq(members.isCurrent, true),
      eq(hansardContributions.mandate, mandate),
      sql`${hansardContributions.plenaryDate} >= ${mandateStart} and ${hansardContributions.plenaryDate} <= ${today}`,
    ))
    .groupBy(sql`extract(year from ${hansardContributions.plenaryDate}), extract(month from ${hansardContributions.plenaryDate})`)
    .orderBy(sql`extract(year from ${hansardContributions.plenaryDate}), extract(month from ${hansardContributions.plenaryDate})`)
  return rows
}

export async function getHansardSiteStats(mandate: string = CURRENT_MANDATE) {
  const [sittingsRow, contribRow] = await Promise.all([
    db.select({ totalSittings: sql<number>`count(*)` })
      .from(hansardReports)
      .where(eq(hansardReports.mandate, mandate)),
    db.select({
      totalDebates: sql<number>`count(distinct ${hansardContributions.debateTitle})`,
      totalParticipations: sql<number>`count(*)`,
    }).from(hansardContributions).where(eq(hansardContributions.mandate, mandate)),
  ])
  return {
    totalSittings: sittingsRow[0].totalSittings,
    totalDebates: contribRow[0].totalDebates,
    totalParticipations: contribRow[0].totalParticipations,
  }
}

export async function getHansardSittingsByMonth(mandateStart: string, mandate: string = CURRENT_MANDATE) {
  const today = new Date().toISOString().slice(0, 10)
  const rows = await db
    .select({
      year: sql<number>`extract(year from ${hansardReports.plenaryDate})`,
      month: sql<number>`extract(month from ${hansardReports.plenaryDate})`,
      totalSittings: sql<number>`count(distinct ${hansardReports.plenaryDate})`,
    })
    .from(hansardReports)
    .where(and(
      eq(hansardReports.mandate, mandate),
      sql`${hansardReports.plenaryDate} >= ${mandateStart} and ${hansardReports.plenaryDate} <= ${today}`,
    ))
    .groupBy(sql`extract(year from ${hansardReports.plenaryDate}), extract(month from ${hansardReports.plenaryDate})`)
    .orderBy(sql`extract(year from ${hansardReports.plenaryDate}), extract(month from ${hansardReports.plenaryDate})`)
  return rows
}

export async function getHansardTopByMLA(limit: number, orderBy: 'sittings' | 'debates', mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      personId: members.personId,
      fullName: members.fullName,
      party: members.party,
      imgUrl: members.imgUrl,
      sittings: sql<number>`count(distinct ${hansardContributions.reportDocId})`.as('sittings'),
      debates: sql<number>`count(distinct ${hansardContributions.debateTitle})`.as('debates'),
    })
    .from(members)
    .leftJoin(hansardContributions, and(eq(hansardContributions.personId, members.personId), eq(hansardContributions.mandate, mandate)))
    .where(and(eq(members.isCurrent, true), isNull(members.assemblyRole), eq(members.mandate, mandate)))
    .groupBy(members.personId, members.fullName, members.party, members.imgUrl)
    .orderBy(orderBy === 'sittings'
      ? desc(sql`count(distinct ${hansardContributions.reportDocId})`)
      : desc(sql`count(distinct ${hansardContributions.debateTitle})`))
    .limit(limit)
  return rows
}

export async function getHansardBottomByMLA(limit: number, orderBy: 'sittings' | 'debates', mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      personId: members.personId,
      fullName: members.fullName,
      party: members.party,
      imgUrl: members.imgUrl,
      sittings: sql<number>`count(distinct ${hansardContributions.reportDocId})`.as('sittings'),
      debates: sql<number>`count(distinct ${hansardContributions.debateTitle})`.as('debates'),
    })
    .from(members)
    .leftJoin(hansardContributions, and(eq(hansardContributions.personId, members.personId), eq(hansardContributions.mandate, mandate)))
    .where(and(eq(members.isCurrent, true), isNull(members.assemblyRole), eq(members.mandate, mandate)))
    .groupBy(members.personId, members.fullName, members.party, members.imgUrl)
    .orderBy(orderBy === 'sittings'
      ? asc(sql`count(distinct ${hansardContributions.reportDocId})`)
      : asc(sql`count(distinct ${hansardContributions.debateTitle})`))
    .limit(limit)
  return rows
}

export async function getHansardAllByMLA(mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      personId: members.personId,
      fullName: members.fullName,
      party: members.party,
      constituency: members.constituency,
      imgUrl: members.imgUrl,
      sittings: sql<number>`count(distinct ${hansardContributions.reportDocId})`.as('sittings'),
      debates: sql<number>`count(distinct ${hansardContributions.debateTitle})`.as('debates'),
    })
    .from(members)
    .leftJoin(hansardContributions, and(eq(hansardContributions.personId, members.personId), eq(hansardContributions.mandate, mandate)))
    .where(and(eq(members.isCurrent, true), isNull(members.assemblyRole), eq(members.mandate, mandate)))
    .groupBy(members.personId, members.fullName, members.party, members.constituency, members.imgUrl)
    .orderBy(desc(sql`count(distinct ${hansardContributions.reportDocId})`))
  return rows
}

export async function getHansardPartyAverages(mandate: string = CURRENT_MANDATE): Promise<{ party: string; avgSittings: number; avgDebates: number }[]> {
  const memberTotals = db
    .select({
      party: members.party,
      personId: members.personId,
      sittings: sql<number>`count(distinct ${hansardContributions.reportDocId})`.as('sittings'),
      debates: sql<number>`count(distinct ${hansardContributions.debateTitle})`.as('debates'),
    })
    .from(members)
    .leftJoin(hansardContributions, and(eq(hansardContributions.personId, members.personId), eq(hansardContributions.mandate, mandate)))
    .where(and(eq(members.isCurrent, true), isNull(members.assemblyRole), eq(members.mandate, mandate)))
    .groupBy(members.party, members.personId)
    .as('member_totals')

  const rows = await db
    .select({
      party: memberTotals.party,
      avgSittings: sql<number>`avg(${memberTotals.sittings})`.as('avg_sittings'),
      avgDebates: sql<number>`avg(${memberTotals.debates})`.as('avg_debates'),
    })
    .from(memberTotals)
    .groupBy(memberTotals.party)
    .orderBy(desc(sql`avg(${memberTotals.sittings})`))

  return rows.map(r => ({
    party: r.party ?? '',
    avgSittings: Number(r.avgSittings),
    avgDebates: Number(r.avgDebates),
  }))
}

export async function getHansardThisMonth(mandate: string = CURRENT_MANDATE): Promise<number> {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthEnd = nextMonth.toISOString().slice(0, 10)
  const rows = await db
    .select({ total: sql<number>`count(distinct ${hansardReports.reportDocId})` })
    .from(hansardReports)
    .where(and(
      eq(hansardReports.mandate, mandate),
      sql`${hansardReports.plenaryDate} >= ${monthStart}`,
      sql`${hansardReports.plenaryDate} < ${monthEnd}`,
    ))
  return Number(rows[0]?.total ?? 0)
}

export async function getSittingDays(mandate: string = CURRENT_MANDATE): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as sitting_days
    FROM hansard_reports
    WHERE plenary_date >= ${mandateStartOf(mandate)}
    AND mandate = ${mandate}
  `)
  return Number(result.rows[0]?.sitting_days ?? 0)
}
