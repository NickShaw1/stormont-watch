export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { mandateById, ARCHIVE_PLACEHOLDER_PARAM } from '@/lib/constants/mandates'
import { getAllBills } from '@/lib/db/queries'
import BillDetailPageBody from '@/app/assembly/bills/[id]/BillDetailPageBody'

const mandate = mandateById('2027-2032')!

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

export async function generateStaticParams() {
  const bills = await getAllBills(mandate.id)
  // Cloudflare's adapter rejects a route with zero generated paths; seed a placeholder if empty.
  if (bills.length === 0) return [{ id: ARCHIVE_PLACEHOLDER_PARAM }]
  return bills.map((b) => ({ id: billSlug(b.bill_id) }))
}

export const metadata: Metadata = {
  title: `Bill - ${mandate.label} archive`,
  description: `Legislative stages for a bill from the ${mandate.label} mandate.`,
}

export default async function ArchiveBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (id === ARCHIVE_PLACEHOLDER_PARAM) notFound()
  return <BillDetailPageBody id={id} mandate={mandate} basePath="/archive/2027-2032" />
}
