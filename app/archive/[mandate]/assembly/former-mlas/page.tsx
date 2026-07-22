export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_ARCHIVE_MANDATES, mandateById } from '@/lib/constants/mandates'
import FormerMlasPageBody from '@/app/assembly/former-mlas/FormerMlasPageBody'

export function generateStaticParams() {
  return ALL_ARCHIVE_MANDATES.map((m) => ({ mandate: m.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `Former MLAs - ${m?.label ?? id} archive`,
    description: `Members of the Northern Ireland Legislative Assembly who left during the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchiveFormerMlasPage({ params }: { params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  if (!mandate) notFound()
  return <FormerMlasPageBody mandate={mandate} basePath={`/archive/${id}`} />
}
