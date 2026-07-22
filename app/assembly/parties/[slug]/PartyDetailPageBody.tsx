import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPartyBySlug, getPartyAssemblyStats, getPartyExpenses, getPartyMandateExpenses, getQuestionStatsByParty, getHansardStatsByParty, getHansardPartyRank, getHansardPartyDebateRank, getHansardSittingsByMonthForParty } from '@/lib/db/queries'
import type { CSSProperties } from 'react'
import { partyBorderColor, abbreviateParty } from '@/lib/format'
import type { Mandate } from '@/lib/constants/mandates'
import styles from './partyDetail.module.css'
import PartyDetailClient from './PartyDetailClient'
import PartyStatsClient from './PartyStatsClient'
import PartyExpensesClient from './PartyExpensesClient'
import PartyChamberClient from './PartyChamberClient'

const PARTY_URLS: Record<string, string> = {
  'Sinn Féin': 'https://sinnfein.ie/',
  'Democratic Unionist Party': 'https://mydup.com/',
  'Alliance Party': 'https://www.allianceparty.org/',
  'Ulster Unionist Party': 'https://www.uup.org/',
  'Social Democratic and Labour Party': 'https://www.sdlp.ie/',
  'People Before Profit Alliance': 'https://www.pbp.ie/',
  'Traditional Unionist Voice': 'https://www.tuv.org.uk/',
}

const PARTY_WIKIPEDIA: Record<string, string> = {
  'Sinn Féin': 'https://en.wikipedia.org/wiki/Sinn_F%C3%A9in',
  'Democratic Unionist Party': 'https://en.wikipedia.org/wiki/Democratic_Unionist_Party',
  'Alliance Party': 'https://en.wikipedia.org/wiki/Alliance_Party_of_Northern_Ireland',
  'Ulster Unionist Party': 'https://en.wikipedia.org/wiki/Ulster_Unionist_Party',
  'Social Democratic and Labour Party': 'https://en.wikipedia.org/wiki/Social_Democratic_and_Labour_Party',
  'People Before Profit Alliance': 'https://en.wikipedia.org/wiki/People_Before_Profit',
  'Traditional Unionist Voice': 'https://en.wikipedia.org/wiki/Traditional_Unionist_Voice',
}

const PARTY_DESCRIPTIONS: Record<string, string> = {
  'Sinn Féin': 'Sinn Féin is an Irish republican and democratic socialist political party operating across the island of Ireland. Founded in 1905, the party advocates for Irish unity and has been a central figure in Northern Ireland politics since the Good Friday Agreement.',
  'Democratic Unionist Party': 'The Democratic Unionist Party is a unionist and social conservative political party in Northern Ireland. Founded in 1971 by Ian Paisley, the DUP has been one of the most significant players in Northern Ireland politics for over five decades.',
  'Alliance Party': 'The Alliance Party of Northern Ireland is a cross-community liberal and progressive political party. Founded in 1970, Alliance is distinctive in Northern Ireland politics for drawing support from both unionist and nationalist communities, designating as neither.',
  'Ulster Unionist Party': 'The Ulster Unionist Party is a unionist and liberal conservative political party in Northern Ireland. For much of the twentieth century the UUP was the dominant presence in Northern Ireland politics, governing the region from partition until the introduction of direct rule.',
  'Social Democratic and Labour Party': 'The Social Democratic and Labour Party is an Irish nationalist and social democratic political party in Northern Ireland. Founded in 1970, the SDLP played a pivotal role in the peace process and was instrumental in negotiating the Good Friday Agreement, with former leader John Hume awarded the Nobel Peace Prize in 1998.',
  'People Before Profit Alliance': 'People Before Profit is a left-wing socialist and anti-austerity political party operating across Ireland. The party advocates for radical economic reform, public ownership of key industries, and opposition to austerity measures.',
  'Traditional Unionist Voice': 'Traditional Unionist Voice is a unionist political party in Northern Ireland founded in 2007 by Jim Allister, who remains its leader. The party was established in opposition to the St Andrews Agreement and takes a hardline unionist position.',
  'Independent': 'Independent MLAs sit in the Northern Ireland Assembly without a party designation, elected or choosing to sit outside the main political parties.',
}

/**
 * Shared body for the Party detail page — rendered by both the live route (current
 * mandate, basePath '') and the archive route (`/archive/<id>`). `mandate` drives the
 * queries; `basePath` prefixes internal links.
 */
export default async function PartyDetailPageBody({
  slug,
  mandate,
  basePath,
}: {
  slug: string
  mandate: Mandate
  basePath: string
}) {
  const party = await getPartyBySlug(slug, mandate.id)
  if (!party) notFound()

  const [stats, expenses, mandateExpenses, borderColor, questionStatsRows, hansardStats, hansardPartyRank, hansardPartyDebateRank, hansardSittingsByMonth] = await Promise.all([
    getPartyAssemblyStats(party.party, mandate.id),
    getPartyExpenses(party.party, mandate.id),
    getPartyMandateExpenses(party.party, mandate.id),
    Promise.resolve(partyBorderColor(party.party)),
    getQuestionStatsByParty(party.party, mandate.id),
    getHansardStatsByParty(party.party, mandate.id),
    getHansardPartyRank(party.party, mandate.id),
    getHansardPartyDebateRank(party.party, mandate.id),
    getHansardSittingsByMonthForParty(party.party, mandate.start, mandate.id),
  ])

  const totalQuestions = questionStatsRows.reduce((s, r) => s + r.writtenCount + r.oralCount, 0)
  const writtenCount = questionStatsRows.reduce((s, r) => s + r.writtenCount, 0)
  const oralCount = questionStatsRows.reduce((s, r) => s + r.oralCount, 0)

  const partyUrl = PARTY_URLS[party.party]
  const wikiUrl = PARTY_WIKIPEDIA[party.party]
  const description = PARTY_DESCRIPTIONS[party.party]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PoliticalParty',
    name: party.party,
    url: `https://www.stormontwatch.com${basePath}/assembly/parties/${slug}`,
    ...(PARTY_URLS[party.party] ? { sameAs: [PARTY_URLS[party.party], PARTY_WIKIPEDIA[party.party]].filter(Boolean) } : {}),
  }

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className={styles.partyHeader}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li><Link href={`${basePath}/assembly/parties`}>Parties</Link></li>
            <li><span aria-current="page">{party.party}</span></li>
          </ol>
        </nav>

        <h1 className={styles.partyName} style={{ '--party-c': borderColor } as CSSProperties} aria-label={party.party}>
          <span className={styles.partyNameFull} aria-hidden="true">{party.party}</span>
          <span className={styles.partyNameShort} aria-hidden="true">{party.party === 'Independent' ? 'Independent' : abbreviateParty(party.party)}</span>
        </h1>

        <div className={styles.metaRow}>
          <span className="tag">{party.mlaCount} {party.mlaCount === 1 ? 'MLA' : 'MLAs'}</span>
          {partyUrl && (
            <a href={partyUrl} target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
              Official website<span className={styles.externalLinkArrow}> ↗</span>
            </a>
          )}
          {partyUrl && wikiUrl && <span className={styles.metaSep} aria-hidden="true">·</span>}
          {wikiUrl && (
            <a href={wikiUrl} target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
              Wikipedia<span className={styles.externalLinkArrow}> ↗</span>
            </a>
          )}
        </div>

      </header>

      <PartyDetailClient
        party={party.party}
        mlas={party.mlas}
        ministers={party.ministers ?? []}
        chairs={party.committeeChairs ?? []}
        borderColor={borderColor}
        description={description}
        wikiUrl={wikiUrl}
        totalQuestions={totalQuestions}
        writtenCount={writtenCount}
        oralCount={oralCount}
        questionStats={questionStatsRows}
        statsContent={
          <PartyStatsClient
            stats={stats}
            partyColor={borderColor}
            mlaCount={party.mlaCount}
          />
        }
        chamberContent={
          <PartyChamberClient
            hansardStats={hansardStats}
            hansardPartyRank={hansardPartyRank}
            hansardPartyDebateRank={hansardPartyDebateRank}
            hansardSittingsByMonth={hansardSittingsByMonth}
            partyColor={borderColor}
            party={party.party}
          />
        }
        expensesContent={
          expenses ? (
            <PartyExpensesClient expenses={expenses} mandateExpenses={mandateExpenses} partyColor={borderColor} />
          ) : (
            <p style={{ color: 'var(--ink-3)', padding: '2rem 0' }}>No expenses data available.</p>
          )
        }
      />
    </div>
  )
}
