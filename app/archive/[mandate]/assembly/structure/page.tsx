export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ARCHIVED_MANDATES, mandateById } from '@/lib/constants/mandates'
import StructurePageBody from '@/app/assembly/structure/StructurePageBody'

export function generateStaticParams() {
  return ARCHIVED_MANDATES.map((m) => ({ mandate: m.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `Assembly Structure - ${m?.label ?? id} archive`,
    description: `The Executive, presiding officers, departments and committee chairs of the Northern Ireland Assembly during the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchiveStructurePage({ params }: { params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  if (!mandate) notFound()
  return <StructurePageBody mandate={mandate} basePath={`/archive/${id}`} />
}
