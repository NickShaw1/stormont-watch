import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMemberById, getMemberVotingHistory, getMemberStructureRole, getMemberExpensesWithRank, getRegisteredInterestsByMember, getAllMembersIncludingFormer } from '@/lib/db/queries'

export const revalidate = 86400

export async function generateStaticParams() {
  const members = await getAllMembersIncludingFormer()
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
      images: [
        {
          url: `/assembly/mlas/${params.id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${member.fullName} — Stormont Watch`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      images: [`/assembly/mlas/${params.id}/opengraph-image`],
    },
    alternates: { canonical: `https://www.stormontwatch.com/assembly/mlas/${params.id}` },
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
    : new Date('2022-05-01')

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
            <li><Link href={member.isCurrent ? '/assembly/mlas' : '/assembly/former-mlas'}>{member.isCurrent ? 'MLAs' : 'Former MLAs'}</Link></li>
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
            />
          </div>

          <div className={styles.heroInfo}>
            <span className={`eyebrow${isSpecialRole ? ` ${styles.specialRoleEyebrow}` : ` ${styles.defaultRoleEyebrow}`}`}>{eyebrow}</span>
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
          <VotingRecordClient votes={relevantVotes} memberName={formatMemberName(member.fullName)} noExpensesTab={!latestExpenses && interests.length === 0} />
        </>
      )}
    </div>
  )
}
