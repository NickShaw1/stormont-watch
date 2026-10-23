import { notFound } from 'next/navigation'
import { CalendarDays, CalendarX, Vote, Gauge, MessageCircleQuestion, Users, Mail, MapPin, Gavel, TrendingUp, TrendingDown, Inbox } from 'lucide-react'
import { getMemberById, getMemberVotingHistory, getMemberStructureRole, getAllMemberExpenses, getMandateExpensesRank, getRegisteredInterestsByMember, getQuestionStatsByMember, getQuestionRankForMember, getMemberRoleHistory, getHansardStatsByMember, getHansardRankForMember, getHansardSittingsByMonth, getHansardDebateRankForMember, getAverageAttendance, getMembersGroupedByParty } from '@/lib/db/queries'
import { formatDate, formatMemberName, formatRoleTitle, abbreviateParty, formatConstituency } from '@/lib/format'
import { attendanceFloor, gradeAttendance } from '@/lib/attendance'
import type { Mandate } from '@/lib/constants/mandates'
import { calculateMandateEarnings, getCurrentAnnualSalary, apiRoleToSalaryRole, type RoleInterval } from '@/lib/salaries'
import dynamic from 'next/dynamic'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import styles from './mlaDetail.module.css'

const ActivityTabsClient = dynamic(() => import('./ActivityTabsClient'), { loading: () => <div /> })

const GRADE_STROKE = {
  good: 'var(--sw-success-solid)',
  low: 'var(--sw-accent-warm)',
  poor: 'var(--sw-error-solid)',
} as const

function Ring({ pct, stroke, label }: { pct: number; stroke: string | null; label: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, pct))
  return (
    <svg className={styles.ring} viewBox="0 0 128 128" role="img" aria-label={label}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--sw-surface-subtle)" strokeWidth="12" />
      {stroke && p > 0 && (
        <circle
          cx="64" cy="64" r={r} fill="none" stroke={stroke} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(c * p) / 100} ${c}`} transform="rotate(-90 64 64)"
        />
      )}
    </svg>
  )
}

// Shared by the live route and the archive route; lib/salaries.ts is not mandate-aware.
export default async function MlaDetailPageBody({
  id,
  mandate,
  basePath,
}: {
  id: string
  mandate: Mandate
  basePath: string
}) {
  const [member, history, structureRole, allExpensesRaw, interests, questionStatsRows, questionRank, roleHistory, hansardRows, hansardRank, hansardDebateRank, avgAttendancePct, partyGroups] = await Promise.all([
    getMemberById(id, mandate.id),
    getMemberVotingHistory(id, mandate.id),
    getMemberStructureRole(id, mandate.id),
    getAllMemberExpenses(id, mandate.id),
    getRegisteredInterestsByMember(id, mandate.id),
    getQuestionStatsByMember(id, mandate.id),
    getQuestionRankForMember(id, mandate.id),
    getMemberRoleHistory(id, mandate.id),
    getHansardStatsByMember(id, mandate.id),
    getHansardRankForMember(id, mandate.id),
    getHansardDebateRankForMember(id, mandate.id),
    getAverageAttendance(mandate.id),
    getMembersGroupedByParty(mandate.id),
  ])

  if (!member) notFound()

  const hansardSittingsByMonth = member.mandateStart
    ? await getHansardSittingsByMonth(String(member.mandateStart).slice(0, 10), mandate.id)
    : []

  const mandateExpensesRankRow = await getMandateExpensesRank(member.personId, mandate.id)
  const mandateRank = mandateExpensesRankRow ? Number(mandateExpensesRankRow.rank) : null
  const mandateTotalMembers = mandateExpensesRankRow ? Number(mandateExpensesRankRow.total_members) : null

  const roleIntervals: RoleInterval[] = roleHistory
    .map(r => {
      const salaryRole = apiRoleToSalaryRole(r.roleType, r.role, r.organisation ?? '')
      if (!salaryRole) return null
      return {
        salaryRole,
        startDate: r.startDate,
        endDate: r.endDate ?? null,
      }
    })
    .filter((r): r is RoleInterval => r !== null)

  const today = new Date().toISOString().slice(0, 10)
  const currentSalary = getCurrentAnnualSalary(roleIntervals, today, mandate.id)
  const mandateEarnings = calculateMandateEarnings(roleIntervals, today, mandate.id)

  const totalQuestions = questionStatsRows.reduce((s, r) => s + r.writtenCount + r.oralCount, 0)
  const writtenCount = questionStatsRows.reduce((s, r) => s + r.writtenCount, 0)
  const oralCount = questionStatsRows.reduce((s, r) => s + r.oralCount, 0)

  const mandateStart = member.mandateStart
    ? new Date(member.mandateStart)
    : new Date(mandate.start)

  const roleStart = member.assemblyRoleStart ? new Date(member.assemblyRoleStart) : null
  const roleEnd = member.assemblyRoleEnd ? new Date(member.assemblyRoleEnd) : null

  // isSpeaker drives the N/A and notice display; only true for a currently serving Speaker.
  const isSpeaker = member.assemblyRole === 'Speaker' && !roleEnd
  const isDeputySpeaker = member.assemblyRole === 'Deputy Speaker' || member.assemblyRole === 'Principal Deputy Speaker'

  // Votes cast during Speaker tenure are excluded; deputies keep their full record.
  const everSpeaker = member.assemblyRole === 'Speaker'
  const relevantVotes = history.filter((v) => {
    const divDate = new Date(v.divisionDate)
    if (divDate < mandateStart) return false
    if (everSpeaker && roleStart && divDate >= roleStart && (!roleEnd || divDate < roleEnd)) return false
    return true
  })

  const totalDivisions = relevantVotes.length
  const present = relevantVotes.filter((v) => v.vote !== 'NO_SHOW').length
  const attendancePct = totalDivisions > 0
    ? Math.round((present / totalDivisions) * 100)
    : 0

  const floor = attendanceFloor(partyGroups.flatMap((g) => g.mlas), avgAttendancePct)
  const grade = totalDivisions > 0 ? gradeAttendance(attendancePct, avgAttendancePct, floor) : null

  const hideQuestionsTab = isSpeaker || structureRole?.type === 'minister'

  type ExpenseRow = {
    financial_year: string
    period: string
    constituency_office: string | null
    other_expenses: string | null
    allowances: string | null
    staff_costs: string | null
    total: string | null
    rank: number | null
    total_members: number | null
  }
  const allExpenses = allExpensesRaw as ExpenseRow[]
  const latestExpenses = allExpenses[0] ?? null

  const serialisedInterests = interests.map(i => ({
    ...i,
    registerEntryStartDate: i.registerEntryStartDate?.toISOString() ?? null,
    updatedAt: i.updatedAt?.toISOString() ?? null,
  }))

  const employsFamily = serialisedInterests.some(
    i => i.registerCategory === 'Family members who benefit from Office Cost Expenditure'
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: member.fullName,
    url: `${siteUrl}${basePath}/assembly/mlas/${id}`,
    jobTitle: 'Member of the Legislative Assembly',
    affiliation: member.party ? {
      '@type': 'Organization',
      name: member.party,
    } : undefined,
    areaServed: member.constituency ?? undefined,
  }

  const name = formatMemberName(member.fullName)

  const memberLabel = member.isCurrent ? 'Member of the Legislative Assembly' : 'Former member of the Legislative Assembly'
  const memberLabelShort = member.isCurrent ? 'Member of the Assembly' : 'Former member of the Assembly'

  const eyebrow = (member.assemblyRole?.replace(/\bPrincipal\b/g, 'Pr.'))
    ?? (structureRole?.type === 'minister' ? formatRoleTitle(structureRole.roleTitle) : null)
    ?? (structureRole?.type === 'committeeChair' ? `Chair, ${structureRole.committeeName}` : null)
    ?? memberLabel

  const isSpecialRole = eyebrow !== memberLabel

  const hasActivity = !!latestExpenses || interests.length > 0 || totalQuestions > 0 || hansardRows.length > 0
  const noRecord = !hasActivity && relevantVotes.length === 0

  const attLabel = isSpeaker
    ? 'Does not vote'
    : grade
      ? `Division attendance ${attendancePct}%`
      : 'No divisions held'

  const noticeVote = isSpeaker && relevantVotes.length > 0
    ? `As ${member.assemblyRole}, ${name} no longer participates in Assembly divisions. The voting record below reflects divisions held prior to taking up this role.`
    : undefined


  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="mla-name">
        <div className="container">
          <div className={styles.bento}>
            <div className={`${styles.tile} ${styles.tId}`}>
              <div className={styles.idLead}>
              <div className={styles.photo}>
                <MlaPhoto
                  name={member.fullName}
                  imgUrl={member.imgUrl ?? ''}
                  size={256}
                  decorative
                  priority
                  square
                  personId={member.personId}
                />
              </div>
              <div className={styles.idMain}>
                <span className={`${styles.eyebrow}${isSpecialRole ? '' : ` ${styles.eyebrowMuted}`}`}>{eyebrow === memberLabel ? (
                  <>
                    <span className={styles.lblFull}>{eyebrow}</span>
                    <span className={styles.lblShort} aria-hidden="true">{memberLabelShort}</span>
                  </>
                ) : eyebrow}</span>
                <h1 id="mla-name" className={styles.name}>{name}</h1>
                <div className={styles.pills}>
                  {member.party && (
                    <span className="party-pill" data-party={abbreviateParty(member.party)}>
                      <PartyName party={member.party} />
                    </span>
                  )}
                  {member.constituency && (
                    <span className={styles.pill}>
                      <MapPin size={14} strokeWidth={2} aria-hidden="true" />
                      {formatConstituency(member.constituency)}
                    </span>
                  )}
                </div>
                {member.email && member.isCurrent && (
                  <a href={`mailto:${member.email}`} className={styles.contactBtn}>
                    <Mail size={18} strokeWidth={2} aria-hidden="true" />
                    Contact MLA
                  </a>
                )}
              </div>
              </div>
              <div className={styles.idAtt}>
                <div className={styles.tileHead}>
                  <span className={`${styles.iconTile} ${isSpeaker ? styles.tnAmber : styles.tnGreen}`}>
                    {isSpeaker ? <Gavel size={22} strokeWidth={2} aria-hidden="true" /> : <Gauge size={22} strokeWidth={2} aria-hidden="true" />}
                  </span>
                  <span className={styles.tileLabel}>Division attendance</span>
                </div>
                <div className={styles.attBody}>
                  <span className={styles.ringWrap}>
                    <Ring pct={attendancePct} stroke={grade && !isSpeaker ? GRADE_STROKE[grade] : null} label={attLabel} />
                    <span className={styles.ringNum}>
                      {grade && !isSpeaker ? <>{attendancePct}<span>%</span></> : <span className={styles.ringMuted}>N/A</span>}
                    </span>
                  </span>
                  <div className={styles.attText}>
                    {isSpeaker ? (
                      <>
                        <span className={styles.grade} data-grade="na">Presiding officer</span>
                        <p className={styles.attLine}>Presiding officers do not participate in divisions.</p>
                      </>
                    ) : grade ? (
                      <>
                        <span className={styles.grade} data-grade={grade}>
                          {grade === 'good'
                            ? <TrendingUp size={14} strokeWidth={2.25} aria-hidden="true" />
                            : <TrendingDown size={14} strokeWidth={2.25} aria-hidden="true" />}
                          {grade === 'good' ? 'At or above average' : grade === 'low' ? 'Below average' : 'Far below average'}
                        </span>
                        <p className={styles.attLine}>
                          Voted in <strong>{present}</strong> of <strong>{totalDivisions}</strong> divisions.
                        </p>
                      </>
                    ) : (
                      <>
                        <span className={styles.grade} data-grade="na">No attendance record</span>
                        <p className={styles.attLine}>No divisions were held during this MLA&apos;s tenure.</p>
                      </>
                    )}
                  </div>
                </div>
                {grade && !isSpeaker && (
                  <p className={styles.attFoot}>
                    Average across MLAs: {avgAttendancePct.toFixed(1)}%.
                    {isDeputySpeaker && ' Reflects the full mandate, including periods presiding over sittings.'}
                  </p>
                )}
              </div>
              <ul className={styles.facts}>
                {member.mandateStart && (
                  <li className={styles.fact}>
                    <span className={`${styles.iconTile} ${styles.tnIndigo}`}><CalendarDays size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <span className={styles.factBody}>
                      <span className={styles.factLabel}>Mandate start</span>
                      <span className={styles.factValue}>{formatDate(member.mandateStart)}</span>
                    </span>
                  </li>
                )}
                {!member.isCurrent && member.mandateEnd && (
                  <li className={styles.fact}>
                    <span className={`${styles.iconTile} ${styles.tnGrey}`}><CalendarX size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <span className={styles.factBody}>
                      <span className={styles.factLabel}>Left Assembly</span>
                      <span className={styles.factValue}>{formatDate(member.mandateEnd)}</span>
                    </span>
                  </li>
                )}
                <li className={`${styles.fact}${isSpeaker ? ` ${styles.factHideMobile}` : ''}`}>
                  <span className={`${styles.iconTile} ${styles.tnTeal}`}><Vote size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.factBody}>
                    <span className={styles.factLabel}>Divisions present</span>
                    <span className={styles.factValue}>
                      {isSpeaker || totalDivisions === 0
                        ? <span className={styles.valMuted}>N/A</span>
                        : <>{present}<small>/{totalDivisions}</small></>}
                    </span>
                  </span>
                </li>
                {totalQuestions > 0 && (
                  <li className={styles.fact}>
                    <span className={`${styles.iconTile} ${styles.tnPurple}`}><MessageCircleQuestion size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <span className={styles.factBody}>
                      <span className={styles.factLabel}>Questions asked</span>
                      <span className={styles.factValue}>{totalQuestions.toLocaleString()}</span>
                    </span>
                  </li>
                )}
                {member.isCurrent && (
                  <li className={styles.fact}>
                    <span className={`${styles.iconTile} ${styles.tnCoral}`}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <span className={styles.factBody}>
                      <span className={styles.factLabel}>Family employed</span>
                      <span className={`${styles.factValue} ${employsFamily ? styles.valBad : styles.valGood}`}>
                        {employsFamily ? 'Yes' : 'No'}
                      </span>
                    </span>
                  </li>
                )}
              </ul>
            </div>

          </div>
          {noRecord && (
            <div className={`${styles.tile} ${styles.empty} ${styles.afterBento}`}>
                <span className={`${styles.iconTile} ${styles.tnGrey}`}><Inbox size={22} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <p className={styles.emptyTitle}>No activity on record</p>
                  <p className={styles.emptySub}>
                    {member.mandateStart && member.mandateEnd
                      ? `${name} was an MLA from ${formatDate(member.mandateStart)} to ${formatDate(member.mandateEnd)}. `
                      : ''}
                    No votes, questions, speeches, expenses or registered interests are on record for this period.
                  </p>
                </div>
              </div>
          )}

          {!noRecord && (
            <div className={`${styles.tile} ${styles.activityTile} ${styles.activity}`} role="region" aria-labelledby="activity-heading">
              <h2 id="activity-heading" className="sr-only">Activity &amp; finances</h2>
              <ActivityTabsClient
                key={`${member.personId}-${mandate.id}`}
                votes={relevantVotes}
                avgAttendance={avgAttendancePct}
                attendanceFloor={floor}
                notice={noticeVote}
                allExpenses={allExpenses}
                interests={serialisedInterests}
                totalQuestions={totalQuestions}
                writtenCount={writtenCount}
                oralCount={oralCount}
                questionStats={questionStatsRows}
                hideQuestionsTab={hideQuestionsTab}
                isCurrent={member.isCurrent}
                questionRank={questionRank}
                currentSalary={currentSalary}
                mandateEarnings={mandateEarnings}
                mandateExpensesRank={mandateRank}
                mandateExpensesTotalMembers={mandateTotalMembers}
                hansardRows={hansardRows}
                hansardRank={hansardRank}
                hansardDebateRank={hansardDebateRank}
                hansardSittingsByMonth={hansardSittingsByMonth}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
