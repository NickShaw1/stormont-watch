export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_ARCHIVE_MANDATES, mandateById } from '@/lib/constants/mandates'
import { getAllPartiesWithStats } from '@/lib/db/queries'
import PartyDetailPageBody from '@/app/assembly/parties/[slug]/PartyDetailPageBody'

export async function generateStaticParams() {
  const out: { mandate: string; slug: string }[] = []
  for (const m of ALL_ARCHIVE_MANDATES) {
    const parties = await getAllPartiesWithStats(m.id)
    for (const p of parties) out.push({ mandate: m.id, slug: p.slug })
  }
  return out
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string; slug: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `Party - ${m?.label ?? id} archive`,
    description: `Voting record, attendance and expenses for a party during the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchivePartyDetailPage({ params }: { params: Promise<{ mandate: string; slug: string }> }) {
  const { mandate: id, slug } = await params
  const mandate = mandateById(id)
  if (!mandate) notFound()
  return <PartyDetailPageBody slug={slug} mandate={mandate} basePath={`/archive/${id}`} />
}
