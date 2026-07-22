export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ARCHIVED_MANDATES, mandateById } from '@/lib/constants/mandates'
import VotingPageBody from '@/app/assembly/stats/voting/VotingPageBody'

export function generateStaticParams() {
  return ARCHIVED_MANDATES.map((m) => ({ mandate: m.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `Voting - Stats - ${m?.label ?? id} archive`,
    description: `How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since ${m?.startLabel ?? id}.`,
  }
}

export default async function ArchiveVotingPage({ params }: { params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  if (!mandate) notFound()
  return <VotingPageBody mandate={mandate} basePath={`/archive/${id}`} />
}
