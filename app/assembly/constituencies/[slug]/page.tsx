export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { getConstituencyMlaRows } from '@/lib/db/queries/constituencies'
import { findConstituency } from '@/lib/constituencies'
import { constituencySlug } from '@/lib/utils/constituencySlug'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'
import ConstituencyDetailPageBody from '../ConstituencyDetailPageBody'

export async function generateStaticParams() {
  const rows = await getConstituencyMlaRows(CURRENT_MANDATE.id)
  return [...new Set(rows.map((r) => constituencySlug(r.constituency)))].map((slug) => ({ slug }))
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const name = findConstituency(await getConstituencyMlaRows(CURRENT_MANDATE.id), slug)
  if (!name) return { title: 'Constituency not found' }
  const description = `The MLAs who have held the seats for ${name} in the ${CURRENT_MANDATE.label} mandate, current and former, with attendance, questions and expenses.`
  return {
    title: name,
    description,
    openGraph: {
      title: `${name} - Stormont Watch`,
      description,
      images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch: NI Assembly Transparency' }],
    },
    twitter: {
      card: 'summary_large_image',
    },
    alternates: { canonical: `https://www.stormontwatch.com/assembly/constituencies/${slug}` },
  }
}

export default async function ConstituencyPage({ params }: Props) {
  const { slug } = await params
  return <ConstituencyDetailPageBody slug={slug} mandate={CURRENT_MANDATE} basePath="" />
}
