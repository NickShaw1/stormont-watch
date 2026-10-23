import type { Metadata } from 'next'
import { getAllBills } from '@/lib/db/queries'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'
import { truncateAtWord } from '@/lib/format'
import BillDetailPageBody from './BillDetailPageBody'

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

export async function generateStaticParams() {
  const allBills = await getAllBills()
  return allBills.map(b => ({ id: billSlug(b.bill_id) }))
}

interface Props {
  params: Promise<{ id: string }>
}

async function getBillBySlug(id: string) {
  const allBills = await getAllBills()
  return allBills.find(b => billSlug(b.bill_id) === id) ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const bill = await getBillBySlug(id)
  if (!bill) return { title: 'Bill not found' }
  const displayTitle = bill.royal_assent_date && bill.act_title ? bill.act_title : bill.short_title
  const description = bill.long_title
    ? truncateAtWord(bill.long_title, 158)
    : `All Assembly stages for ${displayTitle}.`
  return {
    title: displayTitle,
    description,
    openGraph: {
      title: `${displayTitle} - Stormont Watch`,
      description,
      images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch: NI Assembly Transparency' }],
    },
    twitter: {
      card: 'summary_large_image',
    },
    alternates: { canonical: `https://www.stormontwatch.com/assembly/bills/${id}` },
  }
}

export default async function BillDetailPage({ params }: Props) {
  const { id } = await params
  return <BillDetailPageBody id={id} mandate={CURRENT_MANDATE} basePath="" />
}
