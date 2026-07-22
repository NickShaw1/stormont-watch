export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import { getAllMembersIncludingFormer } from '@/lib/db/queries'
import MlaDetailPageBody from '@/app/assembly/mlas/[id]/MlaDetailPageBody'

const mandate = mandateById('2027-2032')!

export async function generateStaticParams() {
  const members = await getAllMembersIncludingFormer(mandate.id)
  return members.map((m) => ({ id: m.personId }))
}

export const metadata: Metadata = {
  title: `MLA - ${mandate.label} archive`,
  description: `Voting record, expenses and registered interests during the ${mandate.label} mandate.`,
}

export default async function ArchiveMlaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MlaDetailPageBody id={id} mandate={mandate} basePath="/archive/2027-2032" />
}
