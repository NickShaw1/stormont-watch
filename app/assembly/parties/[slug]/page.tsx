import type { Metadata } from 'next'
import { getAllPartiesWithStats, getPartyBySlug } from '@/lib/db/queries'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'
import PartyDetailPageBody from './PartyDetailPageBody'

export async function generateStaticParams() {
  const parties = await getAllPartiesWithStats()
  return parties.map((p) => ({ slug: p.slug }))
}

interface Props {
  params: Promise<{ slug: string }>
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
      images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
    },
    twitter: {
      card: 'summary_large_image',
    },
    alternates: { canonical: `https://www.stormontwatch.com/assembly/parties/${slug}` },
  }
}

export default async function PartyDetailPage({ params }: Props) {
  const { slug } = await params
  return <PartyDetailPageBody slug={slug} mandate={CURRENT_MANDATE} basePath="" />
}
