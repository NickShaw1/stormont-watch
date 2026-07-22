export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ARCHIVED_MANDATES, mandateById } from '@/lib/constants/mandates'
import { getAllDivisionsFromDb } from '@/lib/db/queries'
import DivisionDetailPageBody from '@/app/assembly/divisions/[id]/DivisionDetailPageBody'

export async function generateStaticParams() {
  const out: { mandate: string; id: string }[] = []
  for (const m of ARCHIVED_MANDATES) {
    const divisions = await getAllDivisionsFromDb(m.id)
    for (const d of divisions) out.push({ mandate: m.id, id: d.documentId })
  }
  return out
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string; id: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `Division - ${m?.label ?? id} archive`,
    description: `Division result during the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchiveDivisionDetailPage({ params }: { params: Promise<{ mandate: string; id: string }> }) {
  const { mandate: id, id: divisionId } = await params
  const mandate = mandateById(id)
  if (!mandate) notFound()
  return <DivisionDetailPageBody id={divisionId} mandate={mandate} basePath={`/archive/${id}`} />
}
