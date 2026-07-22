export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { mandateById } from '@/lib/constants/mandates'
import { getAllDivisionsFromDb } from '@/lib/db/queries'
import DivisionDetailPageBody from '@/app/assembly/divisions/[id]/DivisionDetailPageBody'

const mandate = mandateById('2027-2032')!

export async function generateStaticParams() {
  const divisions = await getAllDivisionsFromDb(mandate.id)
  return divisions.map((d) => ({ id: d.documentId }))
}

export const metadata: Metadata = {
  title: `Division - ${mandate.label} archive`,
  description: `Division result during the ${mandate.label} mandate.`,
}

export default async function ArchiveDivisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DivisionDetailPageBody id={id} mandate={mandate} basePath="/archive/2027-2032" />
}
