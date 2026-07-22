export const dynamic = 'force-static'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ARCHIVED_MANDATES, mandateById } from '@/lib/constants/mandates'
import ActivityPageBody from '@/app/assembly/stats/activity/ActivityPageBody'

export function generateStaticParams() {
  return ARCHIVED_MANDATES.map((m) => ({ mandate: m.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `Activity - Stats - ${m?.label ?? id} archive`,
    description: `Questions to ministers and chamber participation across the ${m?.label ?? id} Northern Ireland Assembly mandate.`,
  }
}

export default async function ArchiveActivityPage({ params }: { params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  if (!mandate) notFound()
  return <ActivityPageBody mandate={mandate} basePath={`/archive/${id}`} />
}
