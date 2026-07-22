export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_ARCHIVE_MANDATES, mandateById, mandateHasBegun } from '@/lib/constants/mandates'
import MlasPageBody from '@/app/assembly/mlas/MlasPageBody'

export function generateStaticParams() {
  return ALL_ARCHIVE_MANDATES.map((m) => ({ mandate: m.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `MLAs - ${m?.label ?? id} archive`,
    description: `Members of the Northern Ireland Legislative Assembly during the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchiveMlasPage({ params }: { params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  if (!mandate || !mandateHasBegun(mandate)) notFound()
  return <MlasPageBody mandate={mandate} basePath={`/archive/${id}`} />
}
