export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ARCHIVED_MANDATES, mandateById } from '@/lib/constants/mandates'
import PartiesPageBody from '@/app/assembly/parties/PartiesPageBody'

export function generateStaticParams() {
  return ARCHIVED_MANDATES.map((m) => ({ mandate: m.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `Parties - ${m?.label ?? id} archive`,
    description: `Every political party in the Northern Ireland Assembly during the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchivePartiesPage({ params }: { params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  if (!mandate) notFound()
  return <PartiesPageBody mandate={mandate} basePath={`/archive/${id}`} />
}
