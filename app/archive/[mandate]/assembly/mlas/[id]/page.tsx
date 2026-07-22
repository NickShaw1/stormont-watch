export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ARCHIVED_MANDATES, mandateById } from '@/lib/constants/mandates'
import { getAllMembersIncludingFormer } from '@/lib/db/queries'
import MlaDetailPageBody from '@/app/assembly/mlas/[id]/MlaDetailPageBody'

export async function generateStaticParams() {
  const out: { mandate: string; id: string }[] = []
  for (const m of ARCHIVED_MANDATES) {
    const members = await getAllMembersIncludingFormer(m.id)
    for (const mem of members) out.push({ mandate: m.id, id: mem.personId })
  }
  return out
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string; id: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `MLA - ${m?.label ?? id} archive`,
    description: `Voting record, expenses and registered interests during the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchiveMlaDetailPage({ params }: { params: Promise<{ mandate: string; id: string }> }) {
  const { mandate: id, id: personId } = await params
  const mandate = mandateById(id)
  if (!mandate) notFound()
  return <MlaDetailPageBody id={personId} mandate={mandate} basePath={`/archive/${id}`} />
}
