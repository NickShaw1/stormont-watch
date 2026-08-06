import { eq, sql, and, count, countDistinct, isNotNull, gte, lte, desc } from 'drizzle-orm'
import { db } from '../client'
import { members, divisions, hansardReports, bills, billStages, registeredInterests } from '../schema'
import { CURRENT_MANDATE } from './helpers'

export async function getHomepageStats(mandate: string = CURRENT_MANDATE) {
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
    db.select({ count: count() }).from(divisions).where(eq(divisions.mandate, mandate)),
    db.select({ count: count() }).from(bills).where(and(isNotNull(bills.royalAssentDate), eq(bills.mandate, mandate))),
    db.select({ count: count() }).from(divisions)
      .where(and(eq(divisions.mandate, mandate), gte(divisions.divisionDate, sql`date_trunc('week', NOW())`))),
    db.select({ count: countDistinct(billStages.billId) }).from(billStages)
      .where(
        and(
          eq(billStages.mandate, mandate),
          gte(billStages.plenaryDate, sql`date_trunc('week', NOW())`),
          lte(billStages.plenaryDate, sql`NOW()`)
        )
      ),
    db.select({ plenaryDate: hansardReports.plenaryDate })
      .from(hansardReports)
      .where(eq(hansardReports.mandate, mandate))
      .orderBy(desc(hansardReports.plenaryDate))
      .limit(1),
    db.select({ count: countDistinct(registeredInterests.personId) })
      .from(registeredInterests)
      .innerJoin(members, eq(registeredInterests.personId, members.personId))
      .where(and(
        eq(registeredInterests.registerCategoryId, '53'),
        eq(registeredInterests.mandate, mandate),
        eq(members.isCurrent, true),
        eq(members.mandate, mandate)
      )),
    db.select({
      passed: sql<number>`COUNT(*) FILTER (WHERE outcome ILIKE '%carried%' OR outcome ILIKE '%agreed%' OR outcome ILIKE '%passed%')`,
      total: count(),
    })
    .from(divisions)
    .where(and(eq(divisions.mandate, mandate), gte(divisions.divisionDate, sql`date_trunc('week', NOW())`))),
    db.select({ count: count() })
      .from(registeredInterests)
      .where(and(eq(registeredInterests.registerCategoryId, '48'), eq(registeredInterests.mandate, mandate))),
    db.select({ count: countDistinct(registeredInterests.personId) })
      .from(registeredInterests)
      .innerJoin(members, eq(registeredInterests.personId, members.personId))
      .where(and(
        eq(registeredInterests.registerCategoryId, '45'),
        eq(registeredInterests.mandate, mandate),
        eq(members.isCurrent, true),
        eq(members.mandate, mandate)
      )),
    db.select({ count: count() })
      .from(registeredInterests)
      .where(and(eq(registeredInterests.registerCategoryId, '47'), eq(registeredInterests.mandate, mandate))),
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
