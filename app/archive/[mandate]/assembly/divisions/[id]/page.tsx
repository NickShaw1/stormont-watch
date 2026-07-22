export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_ARCHIVE_MANDATES, ARCHIVE_PLACEHOLDER_PARAM, mandateById, mandateHasBegun } from '@/lib/constants/mandates'
import { getAllDivisionsFromDb } from '@/lib/db/queries'
import DivisionDetailPageBody from '@/app/assembly/divisions/[id]/DivisionDetailPageBody'

export async function generateStaticParams() {
  const out: { mandate: string; id: string }[] = []
  for (const m of ALL_ARCHIVE_MANDATES) {
    // Not-yet-begun mandate has no divisions yet — one placeholder path so this route still
    // has ≥1 static param (the page body's mandateHasBegun guard 404s it regardless of id).
    if (!mandateHasBegun(m)) {
      out.push({ mandate: m.id, id: ARCHIVE_PLACEHOLDER_PARAM })
      continue
    }
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
  if (!mandate || !mandateHasBegun(mandate)) notFound()
  return <DivisionDetailPageBody id={divisionId} mandate={mandate} basePath={`/archive/${id}`} />
}
