import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMemberById, getMemberVotingHistory, getMemberStructureRole, getMemberExpensesWithRank, getRegisteredInterestsByMember, getAllMembers } from '@/lib/db/queries'

export const revalidate = 86400

export async function generateStaticParams() {
  const members = await getAllMembers()
  return members.map(m => ({ id: m.personId }))
}
import { formatDate, formatMemberName, formatRoleTitle, partyBorderColor, abbreviateParty } from '@/lib/format'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import VotingRecordClient from './VotingRecordClient'
import FinancesTabsClient from './FinancesTabsClient'
import styles from './mlaDetail.module.css'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const member = await getMemberById(params.id)
  if (!member) return { title: 'MLA not found' }
  const description = `Voting record, expenses and registered interests for ${member.fullName}${member.party ? `, ${member.party}` : ''}${member.constituency ? `, ${member.constituency}` : ''}.`
  return {
    title: member.fullName,
    description,
    openGraph: {
      title: `${member.fullName} — Stormont Watch`,
      description,
    },
    alternates: { canonical: `https://stormontwatch.com/assembly/mlas/${params.id}` },
  }
}

export default async function MlaDetailPage({ params }: Props) {
  const [member, history, structureRole, expensesData, interests] = await Promise.all([
    getMemberById(params.id),
    getMemberVotingHistory(params.id),
    getMemberStructureRole(params.id),
    getMemberExpensesWithRank(params.id),
    getRegisteredInterestsByMember(params.id),
  ])

  if (!member) notFound()

  const mandateStart = member.mandateStart
    ? new Date(member.mandateStart)
    : new Date('2024-02-01')

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

  const isPresidingOfficer = !!member.assemblyRole && !roleEnd

  const latestExpenses = expensesData as {
    person_id: string
    financial_year: string
    period: string
    constituency_office: string | null
    other_expenses: string | null
    allowances: string | null
    staff_costs: string | null
    total: string | null
    rank: number
    total_members: number
  } | null

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
    url: `${siteUrl}/assembly/mlas/${params.id}`,
    jobTitle: 'Member of the Legislative Assembly',
    affiliation: member.party ? {
      '@type': 'Organization',
      name: member.party,
    } : undefined,
    areaServed: member.constituency ?? undefined,
  }

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className={styles.header}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            {member.isCurrent ? (
              <>
                <li><Link href="/assembly/mlas">MLAs</Link></li>
                <li aria-current="page">{formatMemberName(member.fullName)}</li>
              </>
            ) : (
              <>
                <li><Link href="/assembly/mlas">MLAs</Link></li>
                <li><Link href="/assembly/former-mlas">Former MLAs</Link></li>
                <li aria-current="page">{formatMemberName(member.fullName)}</li>
              </>
            )}
          </ol>
        </nav>

        <div className={styles.profileCard} style={{ '--party-color': partyBorderColor(member.party) } as React.CSSProperties}>
          <div className={styles.profileSection}>
            <MlaPhoto
              name={member.fullName}
              imgUrl={member.imgUrl ?? ''}
              size={88}
              decorative
            />
            <div className={styles.profileInfo}>
              <h1 className={styles.mlaName}>{formatMemberName(member.fullName)}</h1>
              <div className={styles.pills}>
                {member.party && (
                  <span
                    className={styles.partyPill}
                    style={{ '--party-color': partyBorderColor(member.party) } as React.CSSProperties}
                    data-party={abbreviateParty(member.party)}
                  >
                    <PartyName party={member.party} />
                  </span>
                )}
                {!member.isCurrent && (
                  <span className={styles.formerPill}>Former MLA</span>
                )}
                {member.assemblyRole && (
                  <span className={`${styles.rolePill} ${styles.rolePillInline}`}>{member.assemblyRole}</span>
                )}
                {structureRole?.type === 'minister' && (
                  <span className={`${styles.rolePill} ${styles.rolePillInline}`}>{formatRoleTitle(structureRole.roleTitle)}</span>
                )}
                {structureRole?.type === 'committeeChair' && (
                  <span className={`${styles.rolePill} ${styles.rolePillInline}`}>Chair, {structureRole.committeeName}</span>
                )}
              </div>
              <div className={styles.metaRows}>
                {member.constituency && (
                  <div className={styles.metaRow}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6C3.5 9.5 8 14.5 8 14.5C8 14.5 12.5 9.5 12.5 6C12.5 3.5 10.5 1.5 8 1.5ZM8 7.5C7.2 7.5 6.5 6.8 6.5 6C6.5 5.2 7.2 4.5 8 4.5C8.8 4.5 9.5 5.2 9.5 6C9.5 6.8 8.8 7.5 8 7.5Z" fill="currentColor"/>
                    </svg>
                    <span>{member.constituency}</span>
                  </div>
                )}
                {member.email && member.isCurrent && (
                  <div className={styles.metaRow}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm1 0v.5l5 3.5 5-3.5V4H3zm0 2v6h10V6L8 9.5 3 6z" fill="currentColor"/>
                    </svg>
                    <a href={`mailto:${member.email}`} className={styles.emailLink}>
                      <span className={styles.emailFull}>{member.email}</span>
                      <span className={styles.emailShort}>Contact MLA</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {structureRole && (
            <div className={styles.rolePillsMobile}>
              {structureRole.type === 'minister' && (
                <div className={styles.rolePillCard}>
                  <span className={styles.rolePillValue}>{formatRoleTitle(structureRole.roleTitle)}</span>
                </div>
              )}
              {structureRole.type === 'committeeChair' && (
                <div className={styles.rolePillCard}>
                  <span className={styles.rolePillType}>Committee Chair</span>
                  <span className={styles.rolePillValue}>{structureRole.committeeName}</span>
                </div>
              )}
            </div>
          )}

          <div className={styles.statsBar}>
            {member.assemblyRole && (
              <div className={styles.roleCell}>{member.assemblyRole}</div>
            )}
            {member.mandateStart && (
              <div className={styles.statCell}>
                <span className={styles.statLabel}>Mandate start</span>
                <span className={styles.statValue}>{formatDate(member.mandateStart)}</span>
              </div>
            )}
            {!member.isCurrent && member.mandateEnd && (
              <div className={styles.statCell}>
                <span className={styles.statLabel}>Left Assembly</span>
                <span className={styles.statValue}>{formatDate(member.mandateEnd)}</span>
              </div>
            )}
            <div className={styles.statCell}>
              <span className={styles.statLabel}>Votes present</span>
              <span className={styles.statValue}>
                {isPresidingOfficer
                  ? <span className={styles.statMuted}>—</span>
                  : <>{present}<span className={styles.statOf}>/{totalDivisions}</span></>}
              </span>
            </div>
            <div className={styles.statCell}>
              <span className={styles.statLabel}>Vote Attendance</span>
              {isPresidingOfficer ? (
                <span className={styles.statMuted}>Does not vote</span>
              ) : (
                <span
                  className={styles.attendanceValue}
                  style={{
                    color: attendancePct >= 80 ? '#065F46' : attendancePct >= 60 ? '#92400E' : '#991B1B',
                  }}
                >
                  {attendancePct}%
                </span>
              )}
            </div>
            {member.isCurrent && (
              <div className={styles.statCell}>
                <span className={styles.statLabel}>Family employed</span>
                <span className={styles.statValue} style={{ color: employsFamily ? '#991B1B' : '#065F46' }}>
                  {employsFamily ? 'Yes' : 'No'}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {(latestExpenses || interests.length > 0) && <hr className="section-rule" />}
      {(latestExpenses || interests.length > 0) && (
        <section className={styles.expensesSection} aria-labelledby="finances-heading">
          <h2 id="finances-heading" className={styles.sectionHeading}>Finances &amp; Interests</h2>
          <FinancesTabsClient expenses={latestExpenses} interests={serialisedInterests} />
        </section>
      )}

      <hr className="section-rule" />
      {relevantVotes.length === 0 ? (
        <p className={styles.noVotes}>
          {isPresidingOfficer
            ? 'Presiding officers do not participate in divisions.'
            : 'No voting record available.'}
        </p>
      ) : (
        <VotingRecordClient votes={relevantVotes} memberName={formatMemberName(member.fullName)} noExpensesTab={!latestExpenses && interests.length === 0} />
      )}
    </div>
  )
}
