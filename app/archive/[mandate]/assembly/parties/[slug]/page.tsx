export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_ARCHIVE_MANDATES, ARCHIVE_PLACEHOLDER_PARAM, mandateById, mandateHasBegun } from '@/lib/constants/mandates'
import { getAllPartiesWithStats } from '@/lib/db/queries'
import PartyDetailPageBody from '@/app/assembly/parties/[slug]/PartyDetailPageBody'

export async function generateStaticParams() {
  const out: { mandate: string; slug: string }[] = []
  for (const m of ALL_ARCHIVE_MANDATES) {
    // Not-yet-begun mandate has no parties yet — one placeholder path so this route still
    // has ≥1 static param (the page body's mandateHasBegun guard 404s it regardless of slug).
    if (!mandateHasBegun(m)) {
      out.push({ mandate: m.id, slug: ARCHIVE_PLACEHOLDER_PARAM })
      continue
    }
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
  if (!mandate || !mandateHasBegun(mandate)) notFound()
  return <PartyDetailPageBody slug={slug} mandate={mandate} basePath={`/archive/${id}`} />
}
