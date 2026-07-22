export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ARCHIVED_MANDATES, mandateById } from '@/lib/constants/mandates'
import { getAllBills } from '@/lib/db/queries'
import BillDetailPageBody from '@/app/assembly/bills/[id]/BillDetailPageBody'

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

export async function generateStaticParams() {
  const out: { mandate: string; id: string }[] = []
  for (const m of ARCHIVED_MANDATES) {
    const bills = await getAllBills(m.id)
    for (const b of bills) out.push({ mandate: m.id, id: billSlug(b.bill_id) })
  }
  return out
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string; id: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `Bill - ${m?.label ?? id} archive`,
    description: `Legislative stages for a bill from the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchiveBillDetailPage({ params }: { params: Promise<{ mandate: string; id: string }> }) {
  const { mandate: id, id: billId } = await params
  const mandate = mandateById(id)
  if (!mandate) notFound()
  return <BillDetailPageBody id={billId} mandate={mandate} basePath={`/archive/${id}`} />
}
