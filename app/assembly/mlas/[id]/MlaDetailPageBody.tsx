import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMemberById, getMemberVotingHistory, getMemberStructureRole, getAllMemberExpenses, getMandateExpensesRank, getRegisteredInterestsByMember, getQuestionStatsByMember, getQuestionRankForMember, getMemberRoleHistory, getHansardStatsByMember, getHansardRankForMember, getHansardSittingsByMonth, getHansardDebateRankForMember } from '@/lib/db/queries'
import { formatDate, formatMemberName, formatRoleTitle, partyBorderColor, abbreviateParty } from '@/lib/format'
import type { Mandate } from '@/lib/constants/mandates'
import { calculateMandateEarnings, getCurrentAnnualSalary, apiRoleToSalaryRole, type RoleInterval } from '@/lib/salaries'
import dynamic from 'next/dynamic'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import styles from './mlaDetail.module.css'

const VotingRecordClient = dynamic(() => import('./VotingRecordClient'), { loading: () => <div /> })
const ActivityTabsClient = dynamic(() => import('./ActivityTabsClient'), { loading: () => <div /> })

/**
 * Shared body for the MLA detail page — rendered by both the live route (current
 * mandate, basePath '') and the archive route (`/archive/<id>`). `mandate` drives the
 * queries; `basePath` prefixes internal links.
 *
 * Note: lib/salaries.ts is not mandate-aware — salary calls are left as-is.
 */
export default async function MlaDetailPageBody({
  id,
  mandate,
  basePath,
}: {
  id: string
  mandate: Mandate
  basePath: string
}) {
  const [member, history, structureRole, allExpensesRaw, interests, questionStatsRows, questionRank, roleHistory, hansardRows, hansardRank, hansardDebateRank] = await Promise.all([
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
  // number | null — null when the mandate's pay rates aren't published (shown as "rates
  // pending" rather than a misleading £0) or when no band covers today (archived mandate).
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

  const relevantVotes = history.filter((v) => {
    const divDate = new Date(v.divisionDate)
    if (divDate < mandateStart) return false
    if (roleStart && divDate >= roleStart && (!roleEnd || divDate < roleEnd)) return false
    return true
  })

  const totalDivisions = relevantVotes.length
  const present = relevantVotes.filter((v) => v.vote !== 'NO_SHOW').length
  const attendancePct = totalDivisions > 0
    ? Math.round((present / totalDivisions) * 100)
    : 0

  const isPresidingOfficer = member.assemblyRole === 'Speaker' && !roleEnd
  const hideQuestionsTab = isPresidingOfficer || structureRole?.type === 'minister'

  type ExpenseRow = {
    financial_year: string
    period: string
    constituency_office: string | null
    other_expenses: string | null
    allowances: string | null
    staff_costs: string | null
    total: string | null
    rank: number
    total_members: number
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

  const mobileBadgeLabel = member.assemblyRole
    ? member.assemblyRole.replace(/\bPrincipal\b/g, 'Pr.')
    : structureRole?.type === 'minister' ? 'Minister'
    : structureRole?.type === 'committeeChair' ? 'Chair'
    : eyebrow

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className={styles.header}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href={member.isCurrent ? `${basePath}/assembly/mlas` : `${basePath}/assembly/former-mlas`}>{member.isCurrent ? 'MLAs' : 'Former MLAs'}</Link></li>
            <li aria-current="page">{formatMemberName(member.fullName)}</li>
          </ol>
        </nav>

        <div
          className={styles.mlaHero}
          style={{ '--party-color': partyBorderColor(member.party) } as React.CSSProperties}
        >
          <div className={styles.heroPhoto}>
            <MlaPhoto
              name={member.fullName}
              imgUrl={member.imgUrl ?? ''}
              size={112}
              decorative
              priority
            />
          </div>

          <div className={styles.heroInfo}>
            <span className={`eyebrow${isSpecialRole ? ` ${styles.specialRoleEyebrow}` : ` ${styles.defaultRoleEyebrow}`}`}>
              <span className={styles.eyebrowDesktop}>{eyebrow}</span>
              <span className={styles.eyebrowMobile}>{mobileBadgeLabel}</span>
            </span>
            <h1 className={styles.heroName}>{formatMemberName(member.fullName)}</h1>
            <div className={styles.heroRoleLine}>
              {member.party && (
                <span className="party-pill" data-party={abbreviateParty(member.party)}>
                  <PartyName party={member.party} />
                </span>
              )}
              {!member.isCurrent && (
                <span className={styles.formerPill}>Former MLA</span>
              )}
              {member.constituency && (
                <>
                  <span className={styles.roleDot} aria-hidden>·</span>
                  <span>{member.constituency}</span>
                </>
              )}
            </div>
            {member.email && member.isCurrent && (
              <div className={styles.emailRow}>
                <a href={`mailto:${member.email}`} className={styles.emailLink}>
                  <span className={styles.emailFull}>{member.email}</span>
                  <span className={styles.emailMobile}>Contact MLA</span>
                </a>
                {member.party && (
                  <span className={`party-pill ${styles.emailRowPill}`} data-party={abbreviateParty(member.party)}>
                    {abbreviateParty(member.party)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.profileStats}>
          {member.mandateStart && (
            <div className={styles.statCell}>
              <div className={styles.statLbl}>Mandate start</div>
              <div className={styles.statVal}>{formatDate(member.mandateStart)}</div>
            </div>
          )}
          {!member.isCurrent && member.mandateEnd && (
            <div className={styles.statCell}>
              <div className={styles.statLbl}>Left Assembly</div>
              <div className={styles.statVal}>{formatDate(member.mandateEnd)}</div>
            </div>
          )}
          <div className={styles.statCell}>
            <div className={styles.statLbl}>Divisions present</div>
            <div className={styles.statVal}>
              {isPresidingOfficer
                ? <span className={styles.statMuted}>—</span>
                : <>{present}<span className={styles.statFraction}>/{totalDivisions}</span></>}
            </div>
          </div>
          <div className={styles.statCell}>
            <div className={styles.statLbl}>Vote attendance</div>
            {isPresidingOfficer ? (
              <div className={styles.statMuted}>Does not vote</div>
            ) : totalDivisions === 0 ? (
              <div className={styles.statMuted}>N/A</div>
            ) : (
              <>
                <div
                  className={styles.statVal}
                  style={{
                    color: attendancePct >= 80 ? 'var(--forest)' : attendancePct >= 60 ? '#92400E' : 'var(--crimson)',
                  }}
                >
                  {attendancePct}%
                </div>
                <div className={styles.statSub}>
                  {attendancePct >= 80 ? 'Above average' : attendancePct >= 60 ? 'Below average' : 'Significantly below average'}
                </div>
              </>
            )}
          </div>
          {totalQuestions > 0 && (
            <div className={styles.statCell}>
              <div className={styles.statLbl}>Questions asked</div>
              <div className={styles.statVal}>{totalQuestions.toLocaleString()}</div>
              {questionRank && (() => {
                const { rank, totalEligible } = questionRank
                const pctile = totalEligible > 1 ? (rank - 1) / (totalEligible - 1) : 0
                const color = pctile <= 0.33 ? 'var(--forest)' : pctile <= 0.66 ? '#92400E' : 'var(--crimson)'
                return (
                  <div className={styles.statSub} style={{ color }}>
                    Ranked {rank}/{totalEligible}
                  </div>
                )
              })()}
            </div>
          )}
          {member.isCurrent && (
            <div className={styles.statCell}>
              <div className={styles.statLbl}>Family employed</div>
              <div
                className={styles.statVal}
                style={{ color: employsFamily ? 'var(--crimson)' : 'var(--forest)' }}
              >
                {employsFamily ? 'Yes' : 'No'}
              </div>
            </div>
          )}
        </div>
      </header>

      {(latestExpenses || interests.length > 0 || totalQuestions > 0) && <hr className="section-rule" />}
      {(latestExpenses || interests.length > 0 || totalQuestions > 0) && (
        <section className={styles.expensesSection} aria-labelledby="activity-heading">
          <h2 id="activity-heading" className={styles.sectionHeading}>Activity &amp; Finances</h2>
          <ActivityTabsClient
            expenses={latestExpenses}
            allExpenses={allExpenses}
            interests={serialisedInterests}
            totalQuestions={totalQuestions}
            writtenCount={writtenCount}
            oralCount={oralCount}
            questionStats={questionStatsRows}
            hideQuestionsTab={hideQuestionsTab}
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

      <hr className="section-rule" />
      {relevantVotes.length === 0 ? (
        <p className={styles.noVotes}>
          {isPresidingOfficer
            ? 'Presiding officers do not participate in divisions.'
            : totalDivisions === 0
              ? 'No divisions were held during this MLA\'s tenure.'
              : 'No voting record available.'}
        </p>
      ) : (
        <>
          {isPresidingOfficer && (
            <p className={styles.noVotes}>
              * As {member.assemblyRole}, {formatMemberName(member.fullName)} no longer participates in Assembly divisions. The voting record below reflects divisions held prior to taking up this role.
            </p>
          )}
          <VotingRecordClient votes={relevantVotes} memberName={formatMemberName(member.fullName)} noExpensesTab={!latestExpenses && interests.length === 0 && totalQuestions === 0} />
        </>
      )}
    </div>
  )
}
