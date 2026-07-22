export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_ARCHIVE_MANDATES, ARCHIVE_PLACEHOLDER_PARAM, mandateById, mandateHasBegun } from '@/lib/constants/mandates'
import { getAllBills } from '@/lib/db/queries'
import BillDetailPageBody from '@/app/assembly/bills/[id]/BillDetailPageBody'

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

export async function generateStaticParams() {
  const out: { mandate: string; id: string }[] = []
  for (const m of ALL_ARCHIVE_MANDATES) {
    // Not-yet-begun mandate has no bills yet — one placeholder path so this route still
    // has ≥1 static param (the page body's mandateHasBegun guard 404s it regardless of id).
    if (!mandateHasBegun(m)) {
      out.push({ mandate: m.id, id: ARCHIVE_PLACEHOLDER_PARAM })
      continue
    }
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
  if (!mandate || !mandateHasBegun(mandate)) notFound()
  return <BillDetailPageBody id={billId} mandate={mandate} basePath={`/archive/${id}`} />
}
