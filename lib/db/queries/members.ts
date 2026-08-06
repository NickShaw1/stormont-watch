import { eq, desc, sql, and, isNotNull, isNull, gte, asc } from 'drizzle-orm'
import { db } from '../client'
import { members, votes, divisions, ministers, committeeChairs, memberRoleHistory } from '../schema'
import { stripHonorifics } from '@/lib/utils/formatNames'
import { getSurname } from '@/lib/format'
import { CURRENT_MANDATE, mandateStartOf, mlaImg, notServingAsSpeaker, notServingAsPresidingOfficer, isCurrentPresidingOfficer } from './helpers'

export async function getAllMlasByConstituency(mandate: string = CURRENT_MANDATE): Promise<Record<string, { personId: string; fullName: string; party: string; imgUrl: string | null }[]>> {
  const rows = await db
    .select({
      personId: members.personId,
      fullName: members.fullName,
      party: members.party,
      imgUrl: members.imgUrl,
      constituency: members.constituency,
    })
    .from(members)
    .where(and(eq(members.isCurrent, true), isNotNull(members.constituency), eq(members.mandate, mandate)))
    .orderBy(asc(members.fullName))
  const map: Record<string, { personId: string; fullName: string; party: string; imgUrl: string | null }[]> = {}
  for (const r of rows) {
    const c = r.constituency!
    if (!map[c]) map[c] = []
    map[c].push({ personId: r.personId, fullName: r.fullName, party: r.party ?? '', imgUrl: mlaImg(r.personId) })
  }
  return map
}

export async function getMemberById(personId: string, mandate: string = CURRENT_MANDATE) {
  const result = await db
    .select()
    .from(members)
    .where(and(eq(members.personId, personId), eq(members.mandate, mandate)))
    .limit(1)
  const row = result[0] ?? null
  if (!row) return null
  return { ...row, imgUrl: mlaImg(row.personId) }
}

export async function getAllMembers(mandate: string = CURRENT_MANDATE) {
  return db.select().from(members).where(and(eq(members.isCurrent, true), eq(members.mandate, mandate))).orderBy(members.fullName)
}

export async function getAllMandateMembers(mandate: string = CURRENT_MANDATE) {
  return db
    .select({
      personId: members.personId,
      fullName: members.fullName,
      party: members.party,
      constituency: members.constituency,
      imgUrl: members.imgUrl,
      assemblyRole: members.assemblyRole,
      mandateStart: members.mandateStart,
      mandateEnd: members.mandateEnd,
      isCurrent: members.isCurrent,
    })
    .from(members)
    .where(eq(members.mandate, mandate))
    .orderBy(members.fullName)
}

export async function getAllMembersIncludingFormer(mandate: string = CURRENT_MANDATE) {
  // Only current-mandate members (2022-present). Static pages for pre-2022 MLAs are not generated
  // because the site does not cover that era.
  return db
    .select({ personId: members.personId })
    .from(members)
    .where(and(isNotNull(members.mandateStart), gte(members.mandateStart, mandateStartOf(mandate)), eq(members.mandate, mandate)))
    .orderBy(members.fullName)
}


export async function getMemberVotingHistory(personId: string, mandate: string = CURRENT_MANDATE) {
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
    .where(and(eq(votes.personId, personId), eq(votes.mandate, mandate)))
    .orderBy(desc(divisions.divisionDate))
}

export async function getFormerMembers(mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.isCurrent, false),
        sql`${members.mandateStart} >= ${mandateStartOf(mandate)}`,
        eq(members.mandate, mandate)
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

export async function getMembersGroupedByParty(mandate: string = CURRENT_MANDATE) {
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
      -- Only the Speaker is excluded (they don't vote by convention, so their card shows
      -- n/a); Deputy/Principal Deputy Speaker do vote regularly and get a real percentage.
      CASE
        WHEN m.assembly_role = 'Speaker' AND m.assembly_role_end IS NULL THEN NULL
        ELSE ROUND(
          COUNT(v.id) FILTER (WHERE v.vote != 'NO_SHOW' AND
            (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::timestamptz) AND
            ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
          ) * 100.0 /
          NULLIF(COUNT(v.id) FILTER (WHERE
            (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::timestamptz) AND
            ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
          ), 0)
        )
      END as attendance_pct
    FROM members m
    LEFT JOIN votes v ON m.person_id = v.person_id AND v.mandate = ${mandate}
    LEFT JOIN divisions d ON v.document_id = d.document_id AND d.mandate = ${mandate}
    WHERE m.is_current = true
    AND m.mandate = ${mandate}
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

export async function getMlaLeaderboard(mandate: string = CURRENT_MANDATE) {
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
        eq(divisions.mandate, mandate),
        sql`${divisions.divisionDate} >= coalesce(${members.mandateStart}::date, ${mandateStartOf(mandate)}::date)`,
        // This leaderboard deliberately excludes all presiding officers (Speaker, Deputy
        // Speaker, Principal Deputy Speaker), not just the Speaker.
        notServingAsPresidingOfficer(sql`${members.personId}`, sql`${divisions.divisionDate}`)
      )
    )
    .where(and(
      eq(members.isCurrent, true),
      eq(members.mandate, mandate),
      eq(votes.mandate, mandate),
      // A currently-serving presiding officer is dropped from the leaderboard entirely,
      // including any pre-role votes — not just their in-role divisions excluded from the
      // count (that's handled by notServingAsPresidingOfficer above). A FORMER presiding
      // officer reappears once the role has ended, ranked on their non-presiding votes.
      sql`NOT ${isCurrentPresidingOfficer(sql`${members.personId}`)}`
    ))
    .groupBy(members.personId, members.fullName, members.party, members.constituency, members.imgUrl, members.mandateStart)

  return rows.map((r) => ({
    ...r,
    imgUrl: mlaImg(r.personId),
    attendancePct: r.total > 0 ? Math.round((r.present / r.total) * 100) : 0,
  }))
}

export async function getMemberStructureRole(personId: string, mandate: string = CURRENT_MANDATE): Promise<
  | { type: 'minister'; roleTitle: string; department: string }
  | { type: 'committeeChair'; committeeName: string }
  | null
> {
  const [ministerRow, chairRow] = await Promise.all([
    db.select({ roleTitle: ministers.roleTitle, department: ministers.department })
      .from(ministers)
      .where(and(eq(ministers.personId, personId), eq(ministers.mandate, mandate)))
      .limit(1),
    db.select({ committeeName: committeeChairs.committeeName })
      .from(committeeChairs)
      .where(and(eq(committeeChairs.personId, personId), eq(committeeChairs.mandate, mandate)))
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

export async function getAllMinisters(mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      personId: ministers.personId,
      department: ministers.department,
      roleTitle: ministers.roleTitle,
      fullName: members.fullName,
      party: members.party,
      imgUrl: members.imgUrl,
      constituency: members.constituency,
    })
    .from(ministers)
    .innerJoin(members, and(eq(ministers.personId, members.personId), eq(members.mandate, mandate)))
    .where(eq(ministers.mandate, mandate))
    .orderBy(ministers.department)
  return rows.map(r => ({ ...r, imgUrl: mlaImg(r.personId) }))
}

export async function getAllCommitteeChairs(mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      personId: committeeChairs.personId,
      committeeName: committeeChairs.committeeName,
      fullName: members.fullName,
      party: members.party,
      imgUrl: members.imgUrl,
      assemblyRole: members.assemblyRole,
      constituency: members.constituency,
    })
    .from(committeeChairs)
    .innerJoin(members, and(eq(committeeChairs.personId, members.personId), eq(members.mandate, mandate)))
    .where(eq(committeeChairs.mandate, mandate))
    .orderBy(committeeChairs.committeeName)
  return rows.map(r => ({ ...r, imgUrl: mlaImg(r.personId) }))
}

export async function getPresidingOfficers(mandate: string = CURRENT_MANDATE) {
  const ROLE_ORDER: Record<string, number> = { 'Speaker': 1, 'Principal Deputy Speaker': 2, 'Deputy Speaker': 3 }
  const rows = await db
    .select({
      personId: members.personId,
      fullName: members.fullName,
      party: members.party,
      assemblyRole: members.assemblyRole,
      constituency: members.constituency,
    })
    .from(members)
    .where(
      and(
        sql`${members.assemblyRole} ILIKE '%speaker%'`,
        isNull(members.assemblyRoleEnd),
        eq(members.mandate, mandate),
      )
    )
  return rows
    .map(r => ({ ...r, imgUrl: mlaImg(r.personId) }))
    .sort((a, b) => (ROLE_ORDER[a.assemblyRole ?? ''] ?? 99) - (ROLE_ORDER[b.assemblyRole ?? ''] ?? 99))
}

export async function getMemberRoleHistory(personId: string, mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      role: memberRoleHistory.role,
      roleType: memberRoleHistory.roleType,
      organisation: memberRoleHistory.organisation,
      startDate: memberRoleHistory.startDate,
      endDate: memberRoleHistory.endDate,
    })
    .from(memberRoleHistory)
    .where(and(eq(memberRoleHistory.personId, personId), eq(memberRoleHistory.mandate, mandate)))
    .orderBy(memberRoleHistory.startDate)
  return rows
}

export async function getAllMemberRoleHistories(mandate: string = CURRENT_MANDATE) {
  const rows = await db
    .select({
      personId: memberRoleHistory.personId,
      role: memberRoleHistory.role,
      roleType: memberRoleHistory.roleType,
      organisation: memberRoleHistory.organisation,
      startDate: memberRoleHistory.startDate,
      endDate: memberRoleHistory.endDate,
    })
    .from(memberRoleHistory)
    .where(eq(memberRoleHistory.mandate, mandate))
    .orderBy(memberRoleHistory.personId, memberRoleHistory.startDate)
  return rows
}

export async function getLeastEngagedMLA(mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    SELECT
      m.person_id,
      m.full_name,
      m.party,
      m.constituency,
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
    AND m.mandate = ${mandate}
    AND v.mandate = ${mandate}
    AND d.mandate = ${mandate}
    AND d.division_date >= m.mandate_start
    -- Only the Speaker is excluded (they don't vote by convention); Deputy/Principal Deputy
    -- Speaker do vote regularly, so their full record counts, including while presiding.
    AND ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
    GROUP BY m.person_id, m.full_name, m.party, m.constituency, m.img_url
    ORDER BY attendance_pct ASC
    LIMIT 1
  `)
  const row = result.rows[0]
  if (!row) return null
  return {
    personId: String(row.person_id),
    fullName: stripHonorifics(String(row.full_name)),
    party: String(row.party),
    constituency: row.constituency ? String(row.constituency) : null,
    imgUrl: mlaImg(String(row.person_id)),
    attendancePct: Number(row.attendance_pct),
    attended: Number(row.attended),
    total: Number(row.total),
  }
}

export async function getMostEngagedMLA(mandate: string = CURRENT_MANDATE) {
  const result = await db.execute(sql`
    SELECT
      m.person_id,
      m.full_name,
      m.party,
      m.constituency,
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
    AND m.mandate = ${mandate}
    AND v.mandate = ${mandate}
    AND d.mandate = ${mandate}
    AND d.division_date >= m.mandate_start
    -- Only the Speaker is excluded (they don't vote by convention); Deputy/Principal Deputy
    -- Speaker do vote regularly, so their full record counts, including while presiding.
    AND ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
    GROUP BY m.person_id, m.full_name, m.party, m.constituency, m.img_url
    ORDER BY attendance_pct DESC
    LIMIT 1
  `)
  const row = result.rows[0]
  if (!row) return null
  return {
    personId: String(row.person_id),
    fullName: stripHonorifics(String(row.full_name)),
    party: String(row.party),
    constituency: row.constituency ? String(row.constituency) : null,
    imgUrl: mlaImg(String(row.person_id)),
    attendancePct: Number(row.attendance_pct),
    attended: Number(row.attended),
    total: Number(row.total),
  }
}
