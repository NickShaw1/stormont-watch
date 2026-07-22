export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import { getAllPartiesWithStats } from '@/lib/db/queries'
import PartyDetailPageBody from '@/app/assembly/parties/[slug]/PartyDetailPageBody'

const mandate = mandateById('2027-2032')!

export async function generateStaticParams() {
  const parties = await getAllPartiesWithStats(mandate.id)
  return parties.map((p) => ({ slug: p.slug }))
}

export const metadata: Metadata = {
  title: `Party - ${mandate.label} archive`,
  description: `Voting record, attendance and expenses for a party during the ${mandate.label} mandate.`,
}

export default async function ArchivePartyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <PartyDetailPageBody slug={slug} mandate={mandate} basePath="/archive/2027-2032" />
}
