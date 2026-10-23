import type { Metadata } from 'next'
import { getDivisionWithVotes, getAllDivisionsFromDb } from '@/lib/db/queries'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'
import { formatDate, truncateAtWord } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import DivisionDetailPageBody from './DivisionDetailPageBody'

export async function generateStaticParams() {
  const divisions = await getAllDivisionsFromDb()
  return divisions.map(d => ({ id: d.documentId }))
}

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await getDivisionWithVotes(id)
  if (!data) return { title: 'Division not found' }
  const { title: shownTitle, subtitle } = formatDivisionSubject(data.division.title ?? data.division.subject)
  const date = formatDate(data.division.divisionDate?.toISOString())
  const outcome = data.division.outcome ?? 'unknown outcome'
  const headline = subtitle ? `${shownTitle} (${subtitle})` : shownTitle
  const shortHeadline = subtitle ? `${truncateAtWord(shownTitle, 52)} (${subtitle})` : truncateAtWord(shownTitle, 64)
  const pageTitle = `${shortHeadline} (${date})`
  const description = truncateAtWord(`${headline}. Voted ${date}: ${outcome}. ${data.division.totalAyes ?? 0} ayes, ${data.division.totalNoes ?? 0} noes.`, 158)
  return {
    title: pageTitle,
    description,
    openGraph: {
      title: `${pageTitle} - Stormont Watch`,
      description,
      images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch: NI Assembly Transparency' }],
    },
    twitter: {
      card: 'summary_large_image',
    },
    alternates: { canonical: `https://www.stormontwatch.com/assembly/divisions/${id}` },
  }
}

export default async function DivisionDetailPage({ params }: Props) {
  const { id } = await params
  return <DivisionDetailPageBody id={id} mandate={CURRENT_MANDATE} basePath="" />
}
