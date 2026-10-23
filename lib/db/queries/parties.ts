import { sql } from 'drizzle-orm'
import { db } from '../client'
import { CURRENT_MANDATE, mlaImg, notServingAsSpeaker } from './helpers'
import { matchedOutcome } from '@/lib/bills'

export async function getPartyCohesion(mandate: string = CURRENT_MANDATE): Promise<{ party: string; cohesionPct: number; memberCount: number }[]> {
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
      AND (m2.assembly_role IS NULL OR m2.assembly_role_end IS NOT NULL)
      AND m2.mandate = ${mandate}
      AND v.vote != 'NO_SHOW'
      AND v.mandate = ${mandate}
      GROUP BY v.document_id, m2.party
    ) party_votes ON m.party = party_votes.party
    WHERE m.is_current = true
    AND (m.assembly_role IS NULL OR m.assembly_role_end IS NOT NULL)
    AND m.mandate = ${mandate}
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

// Requires 2+ rebellions so one split vote can't top the list on a thin sample.
export async function getMostRebelliousMla(mandate: string = CURRENT_MANDATE): Promise<{
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
      AND (m.assembly_role IS NULL OR m.assembly_role_end IS NOT NULL)
      AND m.mandate = ${mandate}
      AND v.mandate = ${mandate}
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
      AND (m.assembly_role IS NULL OR m.assembly_role_end IS NOT NULL)
      AND m.party != 'Independent'
      AND m.mandate = ${mandate}
      AND v.mandate = ${mandate}
      GROUP BY m.person_id, m.full_name, m.party, m.constituency, m.img_url
      HAVING COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW') > 10
        AND COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW' AND v.vote != pm.majority_vote) >= 2
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

export interface PartyStats {
  party: string
  slug: string
  mlaCount: number
  ministers: { fullName: string; personId: string; imgUrl: string | null; roleTitle: string | null; department: string | null }[] | null
  committeeChairs: { fullName: string; personId: string; imgUrl: string | null; committeeName: string }[] | null
  mlas: { personId: string; fullName: string; imgUrl: string | null; constituency: string | null } [] | null
}

interface PartyDetail extends PartyStats {
  mlas: { personId: string; fullName: string; imgUrl: string | null; constituency: string | null; assemblyRole: string | null; assemblyRoleEnd: string | null; attendancePct: number | null; attendancePctExact: number | null }[]
}

function makePartySlug(party: string): string {
  return party
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export async function getAllPartiesWithStats(mandate: string = CURRENT_MANDATE): Promise<PartyStats[]> {
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
    LEFT JOIN ministers mi ON mi.person_id = m.person_id AND mi.mandate = ${mandate}
    LEFT JOIN members mi_m ON mi_m.person_id = mi.person_id AND mi_m.mandate = ${mandate}
    LEFT JOIN committee_chairs cc ON cc.person_id = m.person_id AND cc.mandate = ${mandate}
    LEFT JOIN members cc_m ON cc_m.person_id = cc.person_id AND cc_m.mandate = ${mandate}
    WHERE m.is_current = true
    AND m.mandate = ${mandate}
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

export async function getPartyBySlug(slug: string, mandate: string = CURRENT_MANDATE): Promise<PartyDetail | null> {
  const all = await getAllPartiesWithStats(mandate)
  const match = all.find((p) => p.slug === slug)
  if (!match) return null

  const mlasResult = await db.execute(sql`
    SELECT
      m.person_id, m.full_name, m.img_url, m.constituency,
      m.assembly_role, m.assembly_role_end,
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
      END as attendance_pct,
      CASE
        WHEN m.assembly_role = 'Speaker' AND m.assembly_role_end IS NULL THEN NULL
        ELSE
          COUNT(v.id) FILTER (WHERE v.vote != 'NO_SHOW' AND
            (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::timestamptz) AND
            ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
          ) * 100.0 /
          NULLIF(COUNT(v.id) FILTER (WHERE
            (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::timestamptz) AND
            ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
          ), 0)
      END as attendance_exact
    FROM members m
    LEFT JOIN votes v ON m.person_id = v.person_id AND v.mandate = ${mandate}
    LEFT JOIN divisions d ON v.document_id = d.document_id AND d.mandate = ${mandate}
    WHERE m.is_current = true
    AND m.mandate = ${mandate}
    AND m.party = ${match.party}
    GROUP BY m.person_id, m.full_name, m.img_url, m.constituency,
             m.mandate_start, m.assembly_role, m.assembly_role_start, m.assembly_role_end
    ORDER BY SPLIT_PART(REGEXP_REPLACE(m.full_name, '^(Mr|Mrs|Miss|Ms|Dr|Lord|Lady|Sir)\s+', '', 'i'), ' ', -1) ASC
  `)

  type MlaRow = { person_id: string; full_name: string; img_url: string | null; constituency: string | null; assembly_role: string | null; assembly_role_end: string | null; attendance_pct: number | null; attendance_exact: string | number | null }

  const mlas = (mlasResult.rows as MlaRow[]).map((r) => ({
    personId: r.person_id,
    fullName: r.full_name,
    imgUrl: mlaImg(r.person_id),
    constituency: r.constituency,
    assemblyRole: r.assembly_role,
    assemblyRoleEnd: r.assembly_role_end,
    attendancePct: r.attendance_pct !== null ? Number(r.attendance_pct) : null,
    attendancePctExact: r.attendance_exact !== null && r.attendance_exact !== undefined ? Number(r.attendance_exact) : null,
  }))

  return { ...match, mlas }
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
  trend: { month: string; attendancePct: number; assemblyPct: number | null }[]
  recentDivisions: {
    documentId: string
    subject: string
    title: string | null
    divisionDate: string
    outcome: string | null
    partyVote: string | null
  }[]
}

export async function getPartyAssemblyStats(party: string, mandate: string = CURRENT_MANDATE): Promise<PartyVoteStats> {
  const [votesResult, mlaResult, trendResult, divisionsResult, assemblyTrendResult] = await Promise.all([
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
      JOIN divisions d ON d.document_id = v.document_id
      WHERE m.mandate = ${mandate}
      AND v.mandate = ${mandate}
      AND d.mandate = ${mandate}
      AND m.party = ${party}
      AND (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::date)
      AND (m.mandate_end IS NULL OR d.division_date::date <= m.mandate_end::date)
      -- Only the Speaker is excluded (they don't vote by convention); Deputy/Principal Deputy
      -- Speaker do vote regularly, so their full record counts, including while presiding.
      AND ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
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
        WHERE m.mandate = ${mandate}
        AND v.mandate = ${mandate}
        AND m.party = ${party}
        AND m.is_current = true
        AND (m.assembly_role IS NULL OR m.assembly_role NOT ILIKE '%speaker%' OR m.assembly_role_end IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM ministers mi
          WHERE mi.person_id = m.person_id
          AND mi.mandate = ${mandate}
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
      WHERE m.mandate = ${mandate}
      AND v.mandate = ${mandate}
      AND d.mandate = ${mandate}
      AND m.party = ${party}
      AND (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::date)
      AND (m.mandate_end IS NULL OR d.division_date::date <= m.mandate_end::date)
      -- Only the Speaker is excluded (they don't vote by convention); Deputy/Principal Deputy
      -- Speaker do vote regularly, so their full record counts, including while presiding.
      AND ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
      GROUP BY DATE_TRUNC('month', d.division_date)
      ORDER BY month_date ASC
    `),
    db.execute(sql`
      SELECT
        d.document_id, d.subject, d.title, d.division_date::text as division_date, d.outcome,
        COUNT(*) FILTER (WHERE v.vote = 'AYE') as aye,
        COUNT(*) FILTER (WHERE v.vote = 'NO') as no,
        COUNT(*) FILTER (WHERE v.vote = 'ABSTAINED') as abstained,
        COUNT(*) FILTER (WHERE v.vote = 'NO_SHOW') as no_show
      FROM divisions d
      JOIN votes v ON v.document_id = d.document_id AND v.mandate = ${mandate}
      JOIN members m ON m.person_id = v.person_id AND m.mandate = ${mandate}
      WHERE m.party = ${party}
      AND d.mandate = ${mandate}
      AND ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
      GROUP BY d.document_id, d.subject, d.title, d.division_date, d.outcome
      ORDER BY d.division_date DESC
      LIMIT 5
    `),
    db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', d.division_date), 'Mon YYYY') as month,
        ROUND(
          COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) * 100.0 /
          NULLIF(COUNT(*), 0), 1
        ) as attendance_pct
      FROM votes v
      JOIN members m ON m.person_id = v.person_id
      JOIN divisions d ON d.document_id = v.document_id
      WHERE m.mandate = ${mandate}
      AND v.mandate = ${mandate}
      AND d.mandate = ${mandate}
      AND (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::date)
      AND (m.mandate_end IS NULL OR d.division_date::date <= m.mandate_end::date)
      AND ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
      GROUP BY DATE_TRUNC('month', d.division_date)
    `),
  ])

  type VoteRow = { aye: string; no: string; abstained: string; no_show: string; attendance_pct: string }
  type MlaRow = { person_id: string; full_name: string; attendance_pct: string; present: string; total: string; constituency: string | null }
  type TrendRow = { month: string; attendance_pct: string }
  type DivRow = { document_id: string; subject: string; title: string | null; division_date: string; outcome: string | null; aye: string; no: string; abstained: string; no_show: string }

  // The party's stance is what most of its MLAs did, and not voting counts as something they did.
  // An exact tie between the leading options is SPLIT, so the result never depends on row order.
  const stanceOf = (r: DivRow): string => {
    const tallies = [['AYE', parseInt(r.aye)], ['NO', parseInt(r.no)], ['ABSTAINED', parseInt(r.abstained)], ['NO_SHOW', parseInt(r.no_show)]] as const
    const top = Math.max(...tallies.map((t) => t[1]))
    const leaders = tallies.filter((t) => t[1] === top)
    return leaders.length > 1 ? 'SPLIT' : leaders[0][0]
  }

  type VoteRowFull = VoteRow & { present: string; total: string }
  const vr = votesResult.rows[0] as VoteRowFull
  const mlaRows = mlaResult.rows as MlaRow[]
  const trendRows = trendResult.rows as TrendRow[]
  const assemblyByMonth = new Map((assemblyTrendResult.rows as TrendRow[]).map((r) => [r.month, parseFloat(r.attendance_pct)]))
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
    trend: trendRows.map((r) => ({ month: r.month, attendancePct: parseFloat(r.attendance_pct), assemblyPct: assemblyByMonth.get(r.month) ?? null })),
    recentDivisions: divRows.map((r) => ({
      documentId: r.document_id,
      subject: r.subject,
      title: r.title,
      divisionDate: r.division_date,
      outcome: r.outcome,
      partyVote: stanceOf(r),
    })),
  }
}

// Mean of each current MLA's own attendance, by party, to one decimal: the same figure as each
// party page (only the Speaker is excluded, and a serving Speaker is dropped entirely).
export async function getPartyAttendanceAll(mandate: string = CURRENT_MANDATE): Promise<{ party: string; attendancePct: number; memberCount: number }[]> {
  const result = await db.execute(sql`
    SELECT
      party,
      COUNT(*) as member_count,
      ROUND(AVG(attendance_pct)::numeric, 1) as attendance_pct
    FROM (
      SELECT
        m.person_id,
        m.party,
        COUNT(*) FILTER (WHERE v.vote != 'NO_SHOW') * 100.0 / COUNT(*) as attendance_pct
      FROM members m
      JOIN votes v ON m.person_id = v.person_id
      JOIN divisions d ON d.document_id = v.document_id
      WHERE m.is_current = true
      AND m.mandate = ${mandate}
      AND v.mandate = ${mandate}
      AND d.mandate = ${mandate}
      AND m.party IS NOT NULL
      AND NOT (COALESCE(m.assembly_role, '') = 'Speaker' AND m.assembly_role_end IS NULL)
      AND (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::date)
      AND ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
      GROUP BY m.person_id, m.party
    ) per_mla
    GROUP BY party
    ORDER BY attendance_pct DESC
  `)
  type Row = { party: string; attendance_pct: unknown; member_count: unknown }
  return (result.rows as unknown as Row[]).map((r) => ({
    party: r.party,
    attendancePct: Number(r.attendance_pct),
    memberCount: Number(r.member_count),
  }))
}

export async function getAllPartyAttendanceTrends(mandate: string = CURRENT_MANDATE): Promise<{ party: string; month: string; attendancePct: number; memberCount: number }[]> {
  const result = await db.execute(sql`
    SELECT
      m.party,
      TO_CHAR(DATE_TRUNC('month', d.division_date), 'Mon YYYY') as month,
      DATE_TRUNC('month', d.division_date) as month_date,
      COUNT(DISTINCT m.person_id) as member_count,
      ROUND(
        COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) * 100.0 /
        NULLIF(COUNT(*), 0), 1
      ) as attendance_pct
    FROM votes v
    JOIN members m ON m.person_id = v.person_id
    JOIN divisions d ON d.document_id = v.document_id
    WHERE m.mandate = ${mandate}
    AND v.mandate = ${mandate}
    AND d.mandate = ${mandate}
    AND m.party IS NOT NULL
    AND (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::date)
    AND (m.mandate_end IS NULL OR d.division_date::date <= m.mandate_end::date)
    -- Only the Speaker is excluded (they don't vote by convention); Deputy/Principal Deputy
    -- Speaker do vote regularly, so their full record counts, including while presiding.
    AND ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
    GROUP BY m.party, DATE_TRUNC('month', d.division_date)
    ORDER BY month_date ASC
  `)
  type Row = { party: string; month: string; attendance_pct: unknown; member_count: unknown }
  return (result.rows as unknown as Row[]).map((r) => ({
    party: r.party,
    month: r.month,
    attendancePct: Number(r.attendance_pct),
    memberCount: Number(r.member_count),
  }))
}

// Shared CTE chain: per-party vote tallies -> majority position -> SF/DUP positions.
// Used verbatim by the four SF/DUP agreement queries below.
function partyMajorityCtes(mandate: string) {
  return sql`party_votes AS (
      SELECT
        v.document_id,
        m.party,
        COUNT(*) FILTER (WHERE v.vote = 'AYE') AS ayes,
        COUNT(*) FILTER (WHERE v.vote = 'NO') AS noes,
        COUNT(*) FILTER (WHERE v.vote = 'ABSTAINED') AS abstains,
        COUNT(*) FILTER (WHERE v.vote = 'NO_SHOW') AS noshows
      FROM votes v
      JOIN members m ON m.person_id = v.person_id
      WHERE m.mandate = ${mandate}
        AND m.party IS NOT NULL
        AND v.mandate = ${mandate}
      GROUP BY v.document_id, m.party
    ),
    division_majorities AS (
      SELECT
        document_id,
        party,
        CASE
          WHEN ayes > noes AND ayes > abstains AND ayes > noshows THEN 'AYE'
          WHEN noes > ayes AND noes > abstains AND noes > noshows THEN 'NO'
          WHEN abstains > ayes AND abstains > noes AND abstains > noshows THEN 'ABSTAINED'
          WHEN noshows > ayes AND noshows > noes AND noshows > abstains THEN 'NO_SHOW'
          ELSE NULL
        END AS majority_vote
      FROM party_votes
    ),
    sf AS (
      SELECT document_id, majority_vote AS sf_vote
      FROM division_majorities
      WHERE party = 'Sinn Féin' AND majority_vote IS NOT NULL
    ),
    dup AS (
      SELECT document_id, majority_vote AS dup_vote
      FROM division_majorities
      WHERE party = 'Democratic Unionist Party' AND majority_vote IS NOT NULL
    )`
}

// Non-SF/DUP parties' majority positions; appended after partyMajorityCtes.
function smallerPartyCte() {
  return sql`smaller AS (
      SELECT document_id, party, majority_vote
      FROM division_majorities
      WHERE party NOT IN ('Sinn Féin', 'Democratic Unionist Party')
        AND majority_vote IS NOT NULL
    )`
}

export type PartyAlignmentRow = {
  party: string
  sfAgreed: number
  sfAgreePct: number
  dupAgreed: number
  dupAgreePct: number
}

export async function getPartyAlignmentWithBigTwo(mandate: string = CURRENT_MANDATE): Promise<{ rows: PartyAlignmentRow[]; totalDivisions: number }> {
  const result = await db.execute(sql`
    WITH total AS (
      SELECT COUNT(DISTINCT document_id) AS total_divisions
      FROM divisions
      WHERE mandate = ${mandate}
    ),
    ${partyMajorityCtes(mandate)},
    ${smallerPartyCte()}
    SELECT
      s.party,
      (SELECT total_divisions FROM total) AS total_divisions,
      COUNT(DISTINCT sf.document_id) FILTER (WHERE sf.sf_vote = s.majority_vote) AS sf_agreed,
      ROUND(COUNT(DISTINCT sf.document_id) FILTER (WHERE sf.sf_vote = s.majority_vote) * 100.0 / (SELECT total_divisions FROM total), 1) AS sf_agree_pct,
      COUNT(DISTINCT dup.document_id) FILTER (WHERE dup.dup_vote = s.majority_vote) AS dup_agreed,
      ROUND(COUNT(DISTINCT dup.document_id) FILTER (WHERE dup.dup_vote = s.majority_vote) * 100.0 / (SELECT total_divisions FROM total), 1) AS dup_agree_pct
    FROM smaller s
    LEFT JOIN sf ON sf.document_id = s.document_id
    LEFT JOIN dup ON dup.document_id = s.document_id
    GROUP BY s.party
    ORDER BY sf_agree_pct DESC NULLS LAST
  `)

  type Row = Record<string, unknown>
  const rows = result.rows as unknown as Row[]
  const totalDivisions = rows[0] ? Number(rows[0].total_divisions) : 0
  return {
    totalDivisions,
    rows: rows.map((r) => ({
      party: String(r.party),
      sfAgreed: Number(r.sf_agreed),
      sfAgreePct: Number(r.sf_agree_pct),
      dupAgreed: Number(r.dup_agreed),
      dupAgreePct: Number(r.dup_agree_pct),
    })),
  }
}

type BigTwoAgreement = {
  agreed: number
  disagreed: number
  bothAye: number
  bothNo: number
  bothAbstain: number
  bothNoShow: number
  totalDivisions: number
  agreePct: number
}

// How often SF and the DUP recorded the same majority position.
// Shares logic with getPartyAlignmentWithBigTwo.
export async function getBigTwoAgreement(mandate: string = CURRENT_MANDATE): Promise<BigTwoAgreement> {
  const result = await db.execute(sql`
    WITH ${partyMajorityCtes(mandate)}
    SELECT
      COUNT(DISTINCT d.document_id) AS total_divisions,
      COUNT(*) FILTER (WHERE sf.sf_vote = dup.dup_vote) AS agreed,
      COUNT(*) FILTER (WHERE sf.sf_vote IS DISTINCT FROM dup.dup_vote) AS disagreed,
      COUNT(*) FILTER (WHERE sf.sf_vote = 'AYE' AND dup.dup_vote = 'AYE') AS both_aye,
      COUNT(*) FILTER (WHERE sf.sf_vote = 'NO' AND dup.dup_vote = 'NO') AS both_no,
      COUNT(*) FILTER (WHERE sf.sf_vote = 'ABSTAINED' AND dup.dup_vote = 'ABSTAINED') AS both_abstain,
      COUNT(*) FILTER (WHERE sf.sf_vote = 'NO_SHOW' AND dup.dup_vote = 'NO_SHOW') AS both_noshow
    FROM divisions d
    LEFT JOIN sf ON sf.document_id = d.document_id
    LEFT JOIN dup ON dup.document_id = d.document_id
    WHERE d.mandate = ${mandate}
  `)

  const r = (result.rows as unknown as Record<string, unknown>[])[0]
  const totalDivisions = r ? Number(r.total_divisions) : 0
  const agreed = r ? Number(r.agreed) : 0

  return {
    agreed,
    disagreed: r ? Number(r.disagreed) : 0,
    bothAye: r ? Number(r.both_aye) : 0,
    bothNo: r ? Number(r.both_no) : 0,
    bothAbstain: r ? Number(r.both_abstain) : 0,
    bothNoShow: r ? Number(r.both_noshow) : 0,
    totalDivisions,
    agreePct: totalDivisions > 0 ? Math.round((agreed / totalDivisions) * 1000) / 10 : 0,
  }
}

export type AgreedDivisionRow = {
  documentId: string
  subject: string
  title: string | null
  divisionDate: Date
  outcome: string | null
  sharedVote: 'AYE' | 'NO' | 'ABSTAINED' | 'NO_SHOW'
  wonOverall: boolean
}

export type PartyAgreedDivisions = {
  party: string
  sfAgreed: AgreedDivisionRow[]
  dupAgreed: AgreedDivisionRow[]
}

type RawAgreedRow = {
  pair: 'sf' | 'dup'
  party: string
  document_id: string
  subject: string
  title: string | null
  division_date: string
  outcome: string | null
  shared_vote: string
}

// Divisions where a smaller party's majority matched SF's or the DUP's.
// Only the agreed set is returned; shares CTEs with getPartyAlignmentWithBigTwo.
export async function getPartyAgreedDivisions(mandate: string = CURRENT_MANDATE): Promise<PartyAgreedDivisions[]> {
  const result = await db.execute(sql`
    WITH ${partyMajorityCtes(mandate)},
    ${smallerPartyCte()}
    SELECT 'sf' AS pair, s.party, d.document_id, d.subject, d.title, d.division_date, d.outcome, s.majority_vote AS shared_vote
    FROM smaller s
    JOIN sf ON sf.document_id = s.document_id AND sf.sf_vote = s.majority_vote
    JOIN divisions d ON d.document_id = s.document_id

    UNION ALL

    SELECT 'dup' AS pair, s.party, d.document_id, d.subject, d.title, d.division_date, d.outcome, s.majority_vote AS shared_vote
    FROM smaller s
    JOIN dup ON dup.document_id = s.document_id AND dup.dup_vote = s.majority_vote
    JOIN divisions d ON d.document_id = s.document_id

    ORDER BY party, pair, division_date DESC
  `)

  const rows = result.rows as unknown as RawAgreedRow[]
  const byParty = new Map<string, PartyAgreedDivisions>()
  for (const r of rows) {
    if (!byParty.has(r.party)) {
      byParty.set(r.party, { party: r.party, sfAgreed: [], dupAgreed: [] })
    }
    const sharedVote = r.shared_vote as AgreedDivisionRow['sharedVote']
    const row: AgreedDivisionRow = {
      documentId: r.document_id,
      subject: r.subject,
      title: r.title,
      divisionDate: new Date(r.division_date),
      outcome: r.outcome,
      sharedVote,
      wonOverall: matchedOutcome(sharedVote, r.outcome),
    }
    const entry = byParty.get(r.party)!
    if (r.pair === 'sf') entry.sfAgreed.push(row)
    else entry.dupAgreed.push(row)
  }
  return [...byParty.values()]
}

// Divisions where SF's and the DUP's majority positions matched.
// Shares CTEs with getBigTwoAgreement.
export async function getBigTwoAgreedDivisions(mandate: string = CURRENT_MANDATE): Promise<AgreedDivisionRow[]> {
  const result = await db.execute(sql`
    WITH ${partyMajorityCtes(mandate)}
    SELECT d.document_id, d.subject, d.title, d.division_date, d.outcome, sf.sf_vote AS shared_vote
    FROM sf
    JOIN dup ON dup.document_id = sf.document_id AND dup.dup_vote = sf.sf_vote
    JOIN divisions d ON d.document_id = sf.document_id
    ORDER BY d.division_date DESC
  `)

  type RawRow = { document_id: string; subject: string; title: string | null; division_date: string; outcome: string | null; shared_vote: string }
  const rows = result.rows as unknown as RawRow[]
  return rows.map((r) => {
    const sharedVote = r.shared_vote as AgreedDivisionRow['sharedVote']
    return {
      documentId: r.document_id,
      subject: r.subject,
      title: r.title,
      divisionDate: new Date(r.division_date),
      outcome: r.outcome,
      sharedVote,
      wonOverall: matchedOutcome(sharedVote, r.outcome),
    }
  })
}


export interface PartyTrendRanks {
  rankAvgMonth: number
  rankMonthsAbove: number
  partyCount: number
}

// Ranks this party against every party on the two month-by-month measures shown on its Attendance tab.
// Higher attendance ranks first. A month counts as above the Assembly only when the party is more than 1 point ahead.
export async function getPartyTrendRanks(party: string, mandate: string = CURRENT_MANDATE): Promise<PartyTrendRanks | null> {
  const result = await db.execute(sql`
    SELECT
      m.party,
      TO_CHAR(DATE_TRUNC('month', d.division_date), 'Mon YYYY') as month,
      COUNT(CASE WHEN v.vote != 'NO_SHOW' THEN 1 END) as present,
      COUNT(*) as total
    FROM votes v
    JOIN members m ON m.person_id = v.person_id
    JOIN divisions d ON d.document_id = v.document_id
    WHERE m.mandate = ${mandate}
    AND v.mandate = ${mandate}
    AND d.mandate = ${mandate}
    AND m.party IS NOT NULL
    AND (m.mandate_start IS NULL OR d.division_date >= m.mandate_start::date)
    AND (m.mandate_end IS NULL OR d.division_date::date <= m.mandate_end::date)
    AND ${notServingAsSpeaker(sql`m.person_id`, sql`d.division_date`)}
    GROUP BY m.party, DATE_TRUNC('month', d.division_date)
  `)
  type Row = { party: string; month: string; present: string; total: string }
  const rows = result.rows as Row[]
  const round1 = (n: number) => Math.round(n * 10) / 10

  const assembly = new Map<string, { present: number; total: number }>()
  for (const r of rows) {
    const a = assembly.get(r.month) ?? { present: 0, total: 0 }
    a.present += parseInt(r.present)
    a.total += parseInt(r.total)
    assembly.set(r.month, a)
  }
  const assemblyPct = new Map([...assembly].map(([month, a]) => [month, round1((a.present * 100) / a.total)]))

  const byParty = new Map<string, { avg: number; above: number; months: number }>()
  const grouped = new Map<string, Row[]>()
  for (const r of rows) grouped.set(r.party, [...(grouped.get(r.party) ?? []), r])
  for (const [name, list] of grouped) {
    const pcts = list.map((r) => ({ month: r.month, pct: round1((parseInt(r.present) * 100) / parseInt(r.total)) }))
    const compared = pcts.filter((p) => assemblyPct.has(p.month))
    if (compared.length === 0) continue
    const avg = compared.reduce((x, p) => x + p.pct, 0) / compared.length
    const above = compared.filter((p) => p.pct - (assemblyPct.get(p.month) as number) > 1).length
    byParty.set(name, { avg, above, months: compared.length })
  }
  const mine = byParty.get(party)
  if (!mine) return null
  const all = [...byParty.values()]
  const rankBy = (value: (x: { avg: number; above: number; months: number }) => number) => 1 + all.filter((x) => value(x) > value(mine)).length
  return {
    rankAvgMonth: rankBy((x) => x.avg),
    rankMonthsAbove: rankBy((x) => x.above / x.months),
    partyCount: all.length,
  }
}
