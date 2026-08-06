import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, CalendarX, Vote, Activity, MessageCircleQuestion, Users, Mail, MapPin, ClipboardList, AlertTriangle } from 'lucide-react'
import { getMemberById, getMemberVotingHistory, getMemberStructureRole, getAllMemberExpenses, getMandateExpensesRank, getRegisteredInterestsByMember, getQuestionStatsByMember, getQuestionRankForMember, getMemberRoleHistory, getHansardStatsByMember, getHansardRankForMember, getHansardSittingsByMonth, getHansardDebateRankForMember, getAverageAttendance } from '@/lib/db/queries'
import { formatDate, formatMemberName, formatRoleTitle, partyBorderColor, abbreviateParty } from '@/lib/format'
import type { Mandate } from '@/lib/constants/mandates'
import { calculateMandateEarnings, getCurrentAnnualSalary, apiRoleToSalaryRole, type RoleInterval } from '@/lib/salaries'
import dynamic from 'next/dynamic'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import styles from './mlaDetail.module.css'

const VotingRecordClient = dynamic(() => import('./VotingRecordClient'), { loading: () => <div /> })
const ActivityTabsClient = dynamic(() => import('./ActivityTabsClient'), { loading: () => <div /> })

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
  const [member, history, structureRole, allExpensesRaw, interests, questionStatsRows, questionRank, roleHistory, hansardRows, hansardRank, hansardDebateRank, avgAttendancePct] = await Promise.all([
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
  // null when pay rates aren't published or no band covers today.
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

  // isSpeaker drives the N/A/banner display; only true for a currently serving Speaker.
  // A former Speaker shows their real, non-Speaker-window attendance instead.
  const isSpeaker = member.assemblyRole === 'Speaker' && !roleEnd
  const isDeputySpeaker = member.assemblyRole === 'Deputy Speaker' || member.assemblyRole === 'Principal Deputy Speaker'

  // Excludes votes cast during Speaker tenure, ongoing or ended, from the count.
  // Deputy/Principal Deputy Speaker keep their full record; they vote normally.
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

  const eyebrow = (member.assemblyRole?.replace(/\bPrincipal\b/g, 'Pr.'))
    ?? (structureRole?.type === 'minister' ? formatRoleTitle(structureRole.roleTitle) : null)
    ?? (structureRole?.type === 'committeeChair' ? `Chair, ${structureRole.committeeName}` : null)
    ?? 'Member of the Legislative Assembly'

  const isSpecialRole = eyebrow !== 'Member of the Legislative Assembly'

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className={styles.header}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href={`${basePath}/assembly/mlas`}>MLAs</Link></li>
            <li aria-current="page">{formatMemberName(member.fullName)}</li>
          </ol>
        </nav>

        <div className={styles.mlaHero}>
          <div className={styles.heroIdentity}>
            <div className={styles.heroPhoto}>
              <MlaPhoto
                name={member.fullName}
                imgUrl={member.imgUrl ?? ''}
                size={148}
                decorative
                priority
                noOutline
                personId={member.personId}
              />
            </div>

            <div className={styles.heroInfo}>
              <span className={`${styles.heroEyebrow}${isSpecialRole ? '' : ` ${styles.defaultRoleEyebrow}`}`}>
                {eyebrow}
              </span>
              <h1 className={styles.heroName}>{formatMemberName(member.fullName)}</h1>
              {(member.party || !member.isCurrent || member.constituency) && (
                <div className={styles.heroRow}>
                  {member.party && (
                    <span className="party-pill" data-party={abbreviateParty(member.party)}>
                      <PartyName party={member.party} />
                    </span>
                  )}
                  {!member.isCurrent && (
                    <span className={styles.formerPill}>Former MLA</span>
                  )}
                  {member.constituency && (
                    <span className={styles.heroMetaRow}>
                      <MapPin className={styles.heroRowIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
                      <span>{member.constituency}</span>
                    </span>
                  )}
                </div>
              )}
              {member.email && member.isCurrent && (
                <div className={styles.heroMeta}>
                  <a href={`mailto:${member.email}`} className={styles.emailLink}>
                    <Mail size={14} strokeWidth={1.75} aria-hidden="true" />
                    Contact MLA
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className={styles.profileStats}>
          <div className={styles.statRows}>
            {member.mandateStart && (
              <div className={styles.statCell}>
                <CalendarDays className={styles.statIcon} size={17} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.statLbl}>Mandate start</span>
                <div className={styles.statValCol}>
                  <span className={styles.statVal}>{formatDate(member.mandateStart)}</span>
                </div>
              </div>
            )}
            {!member.isCurrent && member.mandateEnd && (
              <div className={styles.statCell}>
                <CalendarX className={styles.statIcon} size={17} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.statLbl}>Left Assembly</span>
                <div className={styles.statValCol}>
                  <span className={styles.statVal}>{formatDate(member.mandateEnd)}</span>
                </div>
              </div>
            )}
            <div className={styles.statCell}>
              <Vote className={styles.statIcon} size={17} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.statLbl}>Divisions present</span>
              <div className={styles.statValCol}>
                <span className={styles.statVal}>
                  {isSpeaker
                    ? <span className={styles.statMuted}>N/A</span>
                    : <>{present}<span className={styles.statFraction}>/{totalDivisions}</span></>}
                </span>
              </div>
            </div>
            <div className={styles.statCell}>
              <Activity className={styles.statIcon} size={17} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.statLbl}>Vote attendance</span>
              <div className={styles.statValCol}>
                {isSpeaker ? (
                  <span className={styles.statMuted}>Does not vote</span>
                ) : totalDivisions === 0 ? (
                  <span className={styles.statMuted}>N/A</span>
                ) : (
                  <>
                    <span
                      className={styles.statVal}
                      style={{
                        color: attendancePct >= 80 ? 'var(--sw-success)' : attendancePct >= 60 ? 'var(--sw-warning)' : 'var(--sw-error)',
                      }}
                    >
                      {attendancePct}%
                    </span>
                    <span className={styles.statSub}>
                      {isDeputySpeaker
                        ? 'Reflects the full mandate, including periods presiding over sittings.'
                        : (attendancePct >= avgAttendancePct ? 'Above average' : 'Below average')}
                    </span>
                  </>
                )}
              </div>
            </div>
            {totalQuestions > 0 && (
              <div className={styles.statCell}>
                <MessageCircleQuestion className={styles.statIcon} size={17} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.statLbl}>Questions asked</span>
                <div className={styles.statValCol}>
                  <span className={styles.statVal}>{totalQuestions.toLocaleString()}</span>
                  {questionRank && (() => {
                    const { rank, totalEligible } = questionRank
                    const pctile = totalEligible > 1 ? (rank - 1) / (totalEligible - 1) : 0
                    const color = pctile <= 0.33 ? 'var(--sw-success)' : pctile <= 0.66 ? 'var(--sw-warning)' : 'var(--sw-error)'
                    return (
                      <span className={styles.statSub} style={{ color }}>
                        Ranked {rank}/{totalEligible}
                      </span>
                    )
                  })()}
                </div>
              </div>
            )}
            {member.isCurrent && (
              <div className={styles.statCell}>
                <Users className={styles.statIcon} size={17} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.statLbl}>Family employed</span>
                <div className={styles.statValCol}>
                  <span
                    className={styles.statVal}
                    style={{ color: employsFamily ? 'var(--sw-error)' : 'var(--sw-success)' }}
                  >
                    {employsFamily ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </header>

      {(latestExpenses || interests.length > 0 || totalQuestions > 0) && (
        <section className={styles.expensesSection} aria-labelledby="activity-heading">
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>This MLA</span>
            <h2 id="activity-heading" className={styles.sectionHeading}>
              <ClipboardList className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              Activity &amp; Finances
            </h2>
          </div>
          <ActivityTabsClient
            expenses={latestExpenses}
            allExpenses={allExpenses}
            interests={serialisedInterests}
            totalQuestions={totalQuestions}
            writtenCount={writtenCount}
            oralCount={oralCount}
            questionStats={questionStatsRows}
            hideQuestionsTab={hideQuestionsTab}
            isCurrent={member.isCurrent}
            partyColor={partyBorderColor(member.party)}
            questionRank={questionRank}
            currentSalary={currentSalary}
            mandateEarnings={mandateEarnings}
            roleIntervals={roleIntervals}
            mandateExpensesRank={mandateRank}
            mandateExpensesTotalMembers={mandateTotalMembers}
            hansardRows={hansardRows}
            hansardRank={hansardRank}
            hansardDebateRank={hansardDebateRank}
            hansardSittingsByMonth={hansardSittingsByMonth}
          />
        </section>
      )}

      <section className={`${styles.votingSection} ${styles.sectionLast}`}>
        {relevantVotes.length === 0 ? (
          <p className={styles.noVotes}>
            <Vote className={styles.noVotesIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
            {isSpeaker
              ? 'Presiding officers do not participate in divisions.'
              : totalDivisions === 0
                ? 'No divisions were held during this MLA\'s tenure.'
                : 'No voting record available.'}
          </p>
        ) : (
          <>
            {isSpeaker && (
              <div className={styles.presidingOfficerNote}>
                <AlertTriangle className={styles.presidingOfficerNoteIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
                <p className={styles.presidingOfficerNoteText}>
                  As {member.assemblyRole}, {formatMemberName(member.fullName)} no longer participates in Assembly divisions. The voting record below reflects divisions held prior to taking up this role.
                </p>
              </div>
            )}
            <VotingRecordClient votes={relevantVotes} noExpensesTab={!latestExpenses && interests.length === 0 && totalQuestions === 0} />
          </>
        )}
      </section>
    </div>
  )
}
