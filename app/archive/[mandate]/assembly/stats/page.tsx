export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_ARCHIVE_MANDATES, mandateById, mandateHasBegun } from '@/lib/constants/mandates'
import StatsPageBody from '@/app/assembly/stats/StatsPageBody'

export function generateStaticParams() {
  return ALL_ARCHIVE_MANDATES.map((m) => ({ mandate: m.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `Stats - ${m?.label ?? id} archive`,
    description: `Voting, attendance, spending and participation across the ${m?.label ?? id} Northern Ireland Assembly mandate.`,
  }
}

export default async function ArchiveStatsPage({ params }: { params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  if (!mandate || !mandateHasBegun(mandate)) notFound()
  return <StatsPageBody mandate={mandate} basePath={`/archive/${id}`} />
}
