export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { mandateById, ARCHIVE_PLACEHOLDER_PARAM } from '@/lib/constants/mandates'
import { getAllDivisionsFromDb } from '@/lib/db/queries'
import DivisionDetailPageBody from '@/app/assembly/divisions/[id]/DivisionDetailPageBody'

const mandate = mandateById('2027-2032')!

export async function generateStaticParams() {
  const divisions = await getAllDivisionsFromDb(mandate.id)
  // Cloudflare's next-on-pages adapter rejects a dynamicParams=false route with zero generated
  // paths (poisons the whole build, not just this route) — while 2027-2032 has no divisions
  // yet, seed one placeholder path so the route always has ≥1 static output. 404s in the body.
  if (divisions.length === 0) return [{ id: ARCHIVE_PLACEHOLDER_PARAM }]
  return divisions.map((d) => ({ id: d.documentId }))
}

export const metadata: Metadata = {
  title: `Division - ${mandate.label} archive`,
  description: `Division result during the ${mandate.label} mandate.`,
}

export default async function ArchiveDivisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (id === ARCHIVE_PLACEHOLDER_PARAM) notFound()
  return <DivisionDetailPageBody id={id} mandate={mandate} basePath="/archive/2027-2032" />
}
