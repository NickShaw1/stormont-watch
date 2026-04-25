import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllPartiesWithStats, getPartyBySlug, getPartyAssemblyStats, getPartyExpenses, getPartyQuestionStats } from '@/lib/db/queries'
import type { CSSProperties } from 'react'
import { partyBorderColor, abbreviateParty } from '@/lib/format'
import styles from './partyDetail.module.css'
import PartyDetailClient from './PartyDetailClient'
import PartyStatsClient from './PartyStatsClient'
import PartyExpensesClient from './PartyExpensesClient'
import PartyQuestionsClient from './PartyQuestionsClient'

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
  'Independent': 'Claire Sugden is currently the only independent MLA in the Northern Ireland Assembly.',
}

export async function generateStaticParams() {
  const parties = await getAllPartiesWithStats()
  return parties.map((p) => ({ slug: p.slug }))
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const party = await getPartyBySlug(slug)
  if (!party) return { title: 'Party not found' }
  const prose = PARTY_DESCRIPTIONS[party.party]
  const firstSentence = prose ? prose.split('. ')[0] + '.' : null
  const description = firstSentence
    ? `${firstSentence} Track their voting record, attendance, expenses and more on Stormont Watch.`
    : `${party.party} has ${party.mlaCount} ${party.mlaCount === 1 ? 'MLA' : 'MLAs'} in the Northern Ireland Assembly. Track their voting record, attendance, expenses and more.`
  return {
    title: party.party,
    description,
    openGraph: {
      title: `${party.party} — Stormont Watch`,
      description,
      images: [
        {
          url: `/assembly/parties/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${party.party} — Stormont Watch`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      images: [`/assembly/parties/${slug}/opengraph-image`],
    },
    alternates: { canonical: `https://www.stormontwatch.com/assembly/parties/${slug}` },
  }
}

export default async function PartyDetailPage({ params }: Props) {
  const { slug } = await params
  const party = await getPartyBySlug(slug)
  if (!party) notFound()

  const [stats, expenses, borderColor, partyQuestionStatsRaw] = await Promise.all([
    getPartyAssemblyStats(party.party),
    getPartyExpenses(party.party),
    Promise.resolve(partyBorderColor(party.party)),
    getPartyQuestionStats(party.party),
  ])

  const partyQuestionStats = partyQuestionStatsRaw
    ? {
        ...partyQuestionStatsRaw,
        recentQuestions: partyQuestionStatsRaw.recentQuestions.map(q => ({
          ...q,
          answeredOnDate: q.answeredOnDate ?? null,
        })),
      }
    : null
  const partyUrl = PARTY_URLS[party.party]
  const wikiUrl = PARTY_WIKIPEDIA[party.party]
  const description = PARTY_DESCRIPTIONS[party.party]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PoliticalParty',
    name: party.party,
    url: `https://www.stormontwatch.com/assembly/parties/${slug}`,
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
            <li><Link href="/assembly/parties">Parties</Link></li>
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
        statsContent={
          <PartyStatsClient
            stats={stats}
            partyColor={borderColor}
            mlaCount={party.mlaCount}
          />
        }
        expensesContent={
          expenses ? (
            <PartyExpensesClient expenses={expenses} partyColor={borderColor} />
          ) : (
            <p style={{ color: 'var(--ink-3)', padding: '2rem 0' }}>No expenses data available.</p>
          )
        }
        questionsContent={
          partyQuestionStats ? (
            <PartyQuestionsClient
              party={party.party}
              partySlug={slug}
              stats={partyQuestionStats}
            />
          ) : (
            <p style={{ color: 'var(--ink-3)', padding: '2rem 0' }}>No questions data available.</p>
          )
        }
      />
    </div>
  )
}
