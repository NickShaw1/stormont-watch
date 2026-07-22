export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_ARCHIVE_MANDATES, mandateById, mandateHasBegun } from '@/lib/constants/mandates'
import HomePageBody from '@/app/HomePageBody'

export function generateStaticParams() {
  return ALL_ARCHIVE_MANDATES.map((m) => ({ mandate: m.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `Stormont Watch - ${m?.label ?? id} archive`,
    description: `Stormont Watch tracks every vote, bill and expense in the Northern Ireland Assembly during the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchiveHomePage({ params }: { params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  if (!mandate || !mandateHasBegun(mandate)) notFound()
  return <HomePageBody mandate={mandate} basePath={`/archive/${id}`} />
}
