export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ARCHIVED_MANDATES, mandateById } from '@/lib/constants/mandates'
import OverallCostPageBody from '@/app/assembly/overall-cost/OverallCostPageBody'

export function generateStaticParams() {
  return ARCHIVED_MANDATES.map((m) => ({ mandate: m.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `MLA Overall Cost - ${m?.label ?? id} archive`,
    description: `MLA overall public cost during the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchiveOverallCostPage({ params }: { params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  if (!mandate) notFound()
  return <OverallCostPageBody mandate={mandate} basePath={`/archive/${id}`} />
}
