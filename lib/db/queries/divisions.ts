import { eq, desc, sql, and } from 'drizzle-orm'
import { db } from '../client'
import { divisions, votes, people, memberTerms } from '../schema'
import { CURRENT_MANDATE, trendBounds, notServingAsSpeaker } from './helpers'

export async function getAmendmentMotionTexts(baseTitle: string, divisionDateStr: string) {
  const result = await db.execute(sql`
    SELECT motion_text, title, outcome
    FROM divisions
    WHERE title LIKE ${baseTitle + ' - Amendment %'}
      AND division_date::date = ${divisionDateStr}::date
      AND (
        outcome ILIKE '%carried%'
        OR outcome ILIKE '%passed%'
        OR outcome ILIKE '%agreed%'
      )
    ORDER BY title ASC
  `)
  return (result.rows as { motion_text: string | null; title: string; outcome: string | null }[])
    .filter(r => r.motion_text)
}

export async function getDivisionWithVotes(documentId: string, mandate: string = CURRENT_MANDATE) {
  const division = await db
    .select()
    .from(divisions)
    .where(and(eq(divisions.documentId, documentId), eq(divisions.mandate, mandate)))
    .limit(1)

  if (!division[0]) return null

  // Party/designation are shown as at the division's own mandate, not the member's
  // current mandate — so a returning MLA's historical votes keep their period party.
  const divisionMandate = division[0].mandate
  const divisionVotes = await db
    .select({
      vote: votes.vote,
      designation: votes.designation,
      personId: people.personId,
      fullName: people.fullName,
      party: memberTerms.party,
      memberDesignation: memberTerms.designation,
    })
    .from(votes)
    .innerJoin(people, eq(votes.personId, people.personId))
    .leftJoin(memberTerms, and(eq(memberTerms.personId, votes.personId), eq(memberTerms.mandate, divisionMandate)))
    .where(and(
      eq(votes.documentId, documentId),
      // The Speaker doesn't vote by convention, so their routine NO_SHOW rows are hidden —
      // but a real cast vote (e.g. voting on their own Speaker nomination) is never hidden,
      // and Deputy/Principal Deputy Speaker are never excluded (they vote regularly).
      sql`(${votes.vote} != 'NO_SHOW' OR ${memberTerms.assemblyRole} IS DISTINCT FROM 'Speaker')`
    ))
    .orderBy(votes.vote, people.fullName)

  return { division: division[0], votes: divisionVotes }
}

export async function getAllDivisionsFromDb(mandate: string = CURRENT_MANDATE) {
  return db
    .select()
    .from(divisions)
    .where(eq(divisions.mandate, mandate))
    .orderBy(desc(divisions.divisionDate))
}

export async function getAllDivisionsForList(mandate: string = CURRENT_MANDATE) {
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
    .where(eq(divisions.mandate, mandate))
    .orderBy(desc(divisions.divisionDate))
}

export async function getMostCrossCommunityAgreement(mandate: string = CURRENT_MANDATE): Promise<typeof divisions.$inferSelect | null> {
  const result = await db.execute(sql`
    SELECT
      document_id as "documentId",
      event_id as "eventId",
      subject,
      division_date as "divisionDate",
      division_type as "divisionType",
      outcome,
      total_ayes as "totalAyes",
      total_noes as "totalNoes",
      total_abstains as "totalAbstains",
      nationalist_ayes as "nationalistAyes",
      unionist_ayes as "unionistAyes",
      other_ayes as "otherAyes",
      nationalist_noes as "nationalistNoes",
      unionist_noes as "unionistNoes",
      other_noes as "otherNoes",
      motion_text as "motionText",
      title,
      tabled_by as "tabledBy",
      is_motion_amendment as "isMotionAmendment",
      parent_motion_text as "parentMotionText",
      mandate,
      updated_at as "updatedAt",
      CASE
        WHEN nationalist_ayes > nationalist_noes AND unionist_ayes > unionist_noes THEN
          LEAST(
            nationalist_ayes::float / NULLIF(nationalist_ayes + nationalist_noes, 0),
            unionist_ayes::float / NULLIF(unionist_ayes + unionist_noes, 0)
          )
        WHEN nationalist_noes > nationalist_ayes AND unionist_noes > unionist_ayes THEN
          LEAST(
            nationalist_noes::float / NULLIF(nationalist_ayes + nationalist_noes, 0),
            unionist_noes::float / NULLIF(unionist_ayes + unionist_noes, 0)
          )
        ELSE 0
      END as agreement_score
    FROM divisions
    WHERE nationalist_ayes + nationalist_noes > 3
    AND unionist_ayes + unionist_noes > 3
    AND mandate = ${mandate}
    ORDER BY agreement_score DESC,
      (nationalist_ayes + nationalist_noes + unionist_ayes + unionist_noes) DESC,
      division_date DESC
    LIMIT 1
  `)
  return (result.rows[0] as typeof divisions.$inferSelect) ?? null
}

export async function getAssemblyStats(mandate: string = CURRENT_MANDATE) {
  const [totalDivisions, crossCommunityCount, mostContested, mostUnanimous] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(divisions).where(eq(divisions.mandate, mandate)),
    db.select({ count: sql<number>`count(*)` }).from(divisions).where(and(eq(divisions.divisionType, 'Cross-Community'), eq(divisions.mandate, mandate))),
    db.select().from(divisions).where(and(sql`total_ayes + total_noes > 0`, eq(divisions.mandate, mandate))).orderBy(sql`ABS(total_ayes - total_noes) ASC`).limit(1),
    db.select().from(divisions).where(and(sql`total_ayes + total_noes > 0`, eq(divisions.mandate, mandate))).orderBy(sql`total_ayes::float / (total_ayes + total_noes) DESC`).limit(1),
  ])
  return {
    totalDivisions: Number(totalDivisions[0]?.count ?? 0),
    crossCommunityCount: Number(crossCommunityCount[0]?.count ?? 0),
    mostContested: mostContested[0] ?? null,
    mostUnanimous: mostUnanimous[0] ?? null,
  }
}

export async function getAverageAttendance(mandate: string = CURRENT_MANDATE): Promise<number> {
  const result = await db.execute(sql`
    SELECT ROUND(AVG(attendance_pct)::numeric, 1) as avg_pct
    FROM (
      SELECT
        m.person_id,
        COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW') * 100.0 / COUNT(*) as attendance_pct
      FROM members m
      JOIN votes v ON m.person_id = v.person_id
      JOIN divisions d ON d.document_id = v.document_id
      WHERE m.is_current = true
      AND m.mandate = ${mandate}
      AND v.mandate = ${mandate}
      AND (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::date)
      -- Only the Speaker is excluded (they don't vote by convention); Deputy/Principal Deputy
      -- Speaker do vote regularly, so their full record counts, including while presiding.
      AND ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
      GROUP BY m.person_id
    ) attendance
  `)
  return Number(result.rows[0]?.avg_pct ?? 0)
}

// agreement_pct excludes divisions where a whole bloc cast no votes.
export async function getCrossCommunityTrends(mandate: string = CURRENT_MANDATE) {
  const { startSql, endSql } = trendBounds(mandate)
  const result = await db.execute(sql`
    SELECT
      gs.month,
      COALESCE(d.total_divisions, 0) as total_divisions,
      COALESCE(d.comparable_divisions, 0) as comparable_divisions,
      COALESCE(d.agreed_divisions, 0) as agreed_divisions,
      d.agreement_pct
    FROM generate_series(
      DATE_TRUNC('month', ${startSql}),
      DATE_TRUNC('month', ${endSql}),
      INTERVAL '1 month'
    ) AS gs(month)
    LEFT JOIN (
      SELECT
        DATE_TRUNC('month', division_date) as month,
        COUNT(*) as total_divisions,
        COUNT(*) FILTER (WHERE (nationalist_ayes + nationalist_noes) > 0 AND (unionist_ayes + unionist_noes) > 0) as comparable_divisions,
        COUNT(*) FILTER (WHERE
          (nationalist_ayes + nationalist_noes) > 0 AND (unionist_ayes + unionist_noes) > 0
          AND ((unionist_ayes > unionist_noes AND nationalist_ayes > nationalist_noes)
          OR (unionist_noes > unionist_ayes AND nationalist_noes > nationalist_ayes))
        ) as agreed_divisions,
        ROUND(
          COUNT(*) FILTER (WHERE
            (nationalist_ayes + nationalist_noes) > 0 AND (unionist_ayes + unionist_noes) > 0
            AND ((unionist_ayes > unionist_noes AND nationalist_ayes > nationalist_noes)
            OR (unionist_noes > unionist_ayes AND nationalist_noes > nationalist_ayes))
          ) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE (nationalist_ayes + nationalist_noes) > 0 AND (unionist_ayes + unionist_noes) > 0), 0)
        ) as agreement_pct
      FROM divisions
      WHERE division_date >= ${startSql} AND division_date <= ${endSql}
        AND mandate = ${mandate}
      GROUP BY DATE_TRUNC('month', division_date)
    ) d ON gs.month = d.month
    ORDER BY gs.month ASC
  `)
  return result.rows as {
    month: string
    total_divisions: number
    comparable_divisions: number
    agreed_divisions: number
    agreement_pct: number | null
  }[]
}

// Excludes divisions where a whole bloc cast no votes, matching getBlocAgreement.
export async function getOverallAgreementRate(mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    WITH comparable AS (
      SELECT nationalist_ayes, nationalist_noes, unionist_ayes, unionist_noes
      FROM divisions
      WHERE mandate = ${mandate}
        AND (nationalist_ayes + nationalist_noes) > 0
        AND (unionist_ayes + unionist_noes) > 0
    )
    SELECT
      ROUND(
        COUNT(*) FILTER (WHERE
          (nationalist_ayes > (nationalist_noes + nationalist_ayes) * 0.5
            AND unionist_ayes > (unionist_noes + unionist_ayes) * 0.5)
          OR (nationalist_noes > (nationalist_noes + nationalist_ayes) * 0.5
            AND unionist_noes > (unionist_noes + unionist_ayes) * 0.5)
        ) * 100.0 / NULLIF(COUNT(*), 0)
      ) as agreement_pct
    FROM comparable
  `)
  return Number((result.rows[0] as { agreement_pct: unknown }).agreement_pct)
}

export async function getDivisionsPerMonth(mandate: string = CURRENT_MANDATE) {
  const { startSql, endSql } = trendBounds(mandate)
  const result = await db.execute(sql`
    SELECT
      gs.month,
      COALESCE(d.total_divisions, 0) as total_divisions
    FROM generate_series(
      DATE_TRUNC('month', ${startSql}),
      DATE_TRUNC('month', ${endSql}),
      INTERVAL '1 month'
    ) AS gs(month)
    LEFT JOIN (
      SELECT
        DATE_TRUNC('month', division_date) as month,
        COUNT(*) as total_divisions
      FROM divisions
      WHERE division_date >= ${startSql} AND division_date <= ${endSql}
        AND mandate = ${mandate}
      GROUP BY DATE_TRUNC('month', division_date)
    ) d ON gs.month = d.month
    ORDER BY gs.month ASC
  `)
  return result.rows as { month: string; total_divisions: number }[]
}

export async function getLatestDivisions(limit = 5, mandate: string = CURRENT_MANDATE) {
  return db
    .select({
      documentId: divisions.documentId,
      title: divisions.title,
      subject: divisions.subject,
      divisionDate: divisions.divisionDate,
      outcome: divisions.outcome,
    })
    .from(divisions)
    .where(eq(divisions.mandate, mandate))
    .orderBy(desc(divisions.divisionDate))
    .limit(limit)
}

type WeeklyDiaryDay = {
  date: string
  weekday: string
  isToday: boolean
  isPast: boolean
  plenary: { startTime: string | null; endTime: string | null } | null
  agenda: { documentId: string; title: string; plenaryType: string; plenaryTypeId: string }[]
  billStages: { billId: string; shortTitle: string; stage: string }[]
  committees: { organisationName: string; startTime: string | null; endTime: string | null }[]
}

export async function getWeeklyDiary(weekStart: string): Promise<WeeklyDiaryDay[]> {
  const monday = new Date(`${weekStart}T12:00:00Z`)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const weekEnd = sunday.toISOString().slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)

  const [diaryRows, itemRows, stageRows] = await Promise.all([
    db.execute(sql`
      SELECT event_id, event_date::text, event_type, organisation_name,
             start_time, end_time
      FROM plenary_diary
      WHERE event_date >= ${weekStart}::date
        AND event_date <= ${weekEnd}::date
      ORDER BY event_date, start_time
    `),
    db.execute(sql`
      SELECT document_id, title, plenary_date::text, plenary_type, plenary_type_id
      FROM plenary_items
      WHERE plenary_date >= ${weekStart}::date
        AND plenary_date <= ${weekEnd}::date
        AND plenary_type_id != '2'
      ORDER BY plenary_date, title
    `),
    db.execute(sql`
      SELECT DISTINCT ON (bs.bill_id, bs.stage, bs.plenary_date::date)
        bs.bill_id,
        b.short_title,
        bs.stage,
        bs.plenary_date::date::text AS plenary_date
      FROM bill_stages bs
      JOIN bills b ON bs.bill_id = b.bill_id
      WHERE bs.plenary_date::date >= ${weekStart}::date
        AND bs.plenary_date::date <= ${weekEnd}::date
      ORDER BY bs.bill_id, bs.stage, bs.plenary_date::date, bs.plenary_date DESC
    `),
  ])

  type DiaryRow = { event_id: string; event_date: string; event_type: string; organisation_name: string | null; start_time: string | null; end_time: string | null }
  type ItemRow = { document_id: string; title: string; plenary_date: string; plenary_type: string; plenary_type_id: string }
  type StageRow = { bill_id: string; short_title: string; stage: string; plenary_date: string }

  const diary = diaryRows.rows as DiaryRow[]
  const items = itemRows.rows as ItemRow[]
  const stages = stageRows.rows as StageRow[]

  const days: WeeklyDiaryDay[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })

    const dayDiary = diary.filter(r => r.event_date.slice(0, 10) === dateStr)

    const plenaryEvent = dayDiary.find(r => r.event_type === 'plenary') ?? null
    const plenary = plenaryEvent
      ? { startTime: plenaryEvent.start_time, endTime: plenaryEvent.end_time }
      : null

    const committees = dayDiary
      .filter(r => r.event_type === 'committee' && r.organisation_name)
      .map(r => ({ organisationName: r.organisation_name!, startTime: r.start_time, endTime: r.end_time }))

    const agenda = items
      .filter(r => r.plenary_date.slice(0, 10) === dateStr)
      .map(r => ({ documentId: r.document_id, title: r.title, plenaryType: r.plenary_type, plenaryTypeId: r.plenary_type_id }))

    // Bill stages — dedupe by billId+stage, skip if already represented in agenda (prefer plenary_items)
    const agendaBillKeys = new Set(
      agenda
        .map(r => { const m = r.title.match(/\((NIA Bill \S+?)\)?$/); return m ? `${m[1]}||${r.title.split(':')[0]?.trim()}` : null })
        .filter(Boolean) as string[]
    )
    const seenBillStage = new Set<string>()
    const dayBillStages = stages
      .filter(r => r.plenary_date.slice(0, 10) === dateStr)
      .filter(r => {
        const key = `${r.bill_id}||${r.stage}`
        if (seenBillStage.has(key)) return false
        seenBillStage.add(key)
        return !agendaBillKeys.has(key)
      })
      .map(r => ({ billId: r.bill_id, shortTitle: r.short_title, stage: r.stage }))

    days.push({
      date: dateStr,
      weekday,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
      plenary,
      agenda,
      billStages: dayBillStages,
      committees,
    })
  }

  return days
}

type BlocAgreement = {
  agreed: number
  disagreed: number
  bothAye: number
  bothNo: number
  noParticipation: number
  totalDivisions: number
  agreePct: number
}

// Excludes divisions where a whole bloc cast no votes from agreed/disagreed/agreePct.
export async function getBlocAgreement(mandate: string = CURRENT_MANDATE): Promise<BlocAgreement> {
  const result = await db.execute(sql`
    WITH positions AS (
      SELECT
        nationalist_ayes > (nationalist_noes + nationalist_ayes) * 0.5 AS nat_aye,
        nationalist_noes > (nationalist_noes + nationalist_ayes) * 0.5 AS nat_no,
        unionist_ayes > (unionist_noes + unionist_ayes) * 0.5 AS uni_aye,
        unionist_noes > (unionist_noes + unionist_ayes) * 0.5 AS uni_no,
        (nationalist_ayes + nationalist_noes) = 0 AS nat_absent,
        (unionist_ayes + unionist_noes) = 0 AS uni_absent
      FROM divisions
      WHERE mandate = ${mandate}
    )
    SELECT
      COUNT(*) AS total_divisions,
      COUNT(*) FILTER (WHERE nat_absent OR uni_absent) AS no_participation,
      COUNT(*) FILTER (WHERE NOT nat_absent AND NOT uni_absent AND nat_aye AND uni_aye) AS both_aye,
      COUNT(*) FILTER (WHERE NOT nat_absent AND NOT uni_absent AND nat_no AND uni_no) AS both_no
    FROM positions
  `)

  const r = (result.rows as unknown as Record<string, unknown>[])[0]
  const totalDivisions = r ? Number(r.total_divisions) : 0
  const noParticipation = r ? Number(r.no_participation) : 0
  const bothAye = r ? Number(r.both_aye) : 0
  const bothNo = r ? Number(r.both_no) : 0
  const agreed = bothAye + bothNo
  const comparable = totalDivisions - noParticipation

  return {
    agreed,
    disagreed: comparable - agreed,
    bothAye,
    bothNo,
    noParticipation,
    totalDivisions,
    agreePct: comparable > 0 ? Math.round((agreed / comparable) * 1000) / 10 : 0,
  }
}
