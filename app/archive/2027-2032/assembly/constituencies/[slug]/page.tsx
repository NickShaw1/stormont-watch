export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { mandateById, ARCHIVE_PLACEHOLDER_PARAM } from '@/lib/constants/mandates'
import { getConstituencyMlaRows } from '@/lib/db/queries/constituencies'
import { constituencySlug } from '@/lib/utils/constituencySlug'
import ConstituencyDetailPageBody from '@/app/assembly/constituencies/ConstituencyDetailPageBody'

const mandate = mandateById('2027-2032')!

export async function generateStaticParams() {
  const rows = await getConstituencyMlaRows(mandate.id)
  // Cloudflare's adapter rejects a route with zero generated paths; seed a placeholder if empty.
  if (rows.length === 0) return [{ slug: ARCHIVE_PLACEHOLDER_PARAM }]
  return [...new Set(rows.map((r) => constituencySlug(r.constituency)))].map((slug) => ({ slug }))
}

export const metadata: Metadata = {
  title: `Constituency - ${mandate.label} archive`,
  description: `The MLAs who held this constituency's seats during the ${mandate.label} mandate.`,
}

export default async function ArchiveConstituencyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (slug === ARCHIVE_PLACEHOLDER_PARAM) notFound()
  return <ConstituencyDetailPageBody slug={slug} mandate={mandate} basePath="/archive/2027-2032" />
}
