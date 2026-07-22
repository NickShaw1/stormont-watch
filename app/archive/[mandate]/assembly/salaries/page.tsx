export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_ARCHIVE_MANDATES, mandateById, mandateHasBegun } from '@/lib/constants/mandates'
import SalariesPageBody from '@/app/assembly/salaries/SalariesPageBody'

export function generateStaticParams() {
  return ALL_ARCHIVE_MANDATES.map((m) => ({ mandate: m.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `MLA Salaries - ${m?.label ?? id} archive`,
    description: `MLA salaries and mandate earnings during the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchiveSalariesPage({ params }: { params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  if (!mandate || !mandateHasBegun(mandate)) notFound()
  return <SalariesPageBody mandate={mandate} basePath={`/archive/${id}`} />
}
