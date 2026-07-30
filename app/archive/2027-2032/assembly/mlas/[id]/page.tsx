export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { mandateById, ARCHIVE_PLACEHOLDER_PARAM } from '@/lib/constants/mandates'
import { getAllMembersIncludingFormer } from '@/lib/db/queries'
import MlaDetailPageBody from '@/app/assembly/mlas/[id]/MlaDetailPageBody'

const mandate = mandateById('2027-2032')!

export async function generateStaticParams() {
  const members = await getAllMembersIncludingFormer(mandate.id)
  // Cloudflare's adapter rejects a route with zero generated paths; seed a placeholder if empty.
  if (members.length === 0) return [{ id: ARCHIVE_PLACEHOLDER_PARAM }]
  return members.map((m) => ({ id: m.personId }))
}

export const metadata: Metadata = {
  title: `MLA - ${mandate.label} archive`,
  description: `Voting record, expenses and registered interests during the ${mandate.label} mandate.`,
}

export default async function ArchiveMlaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (id === ARCHIVE_PLACEHOLDER_PARAM) notFound()
  return <MlaDetailPageBody id={id} mandate={mandate} basePath="/archive/2027-2032" />
}
