export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { mandateById, ARCHIVE_PLACEHOLDER_PARAM } from '@/lib/constants/mandates'
import { getAllPartiesWithStats } from '@/lib/db/queries'
import PartyDetailPageBody from '@/app/assembly/parties/[slug]/PartyDetailPageBody'

const mandate = mandateById('2027-2032')!

export async function generateStaticParams() {
  const parties = await getAllPartiesWithStats(mandate.id)
  // Cloudflare's next-on-pages adapter rejects a dynamicParams=false route with zero generated
  // paths (poisons the whole build, not just this route) — while 2027-2032 has no parties yet,
  // seed one placeholder path so the route always has ≥1 static output. 404s in the body.
  if (parties.length === 0) return [{ slug: ARCHIVE_PLACEHOLDER_PARAM }]
  return parties.map((p) => ({ slug: p.slug }))
}

export const metadata: Metadata = {
  title: `Party - ${mandate.label} archive`,
  description: `Voting record, attendance and expenses for a party during the ${mandate.label} mandate.`,
}

export default async function ArchivePartyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (slug === ARCHIVE_PLACEHOLDER_PARAM) notFound()
  return <PartyDetailPageBody slug={slug} mandate={mandate} basePath="/archive/2027-2032" />
}
