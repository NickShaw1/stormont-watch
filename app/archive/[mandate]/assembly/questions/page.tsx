export const dynamic = 'force-static'
export const dynamicParams = false

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_ARCHIVE_MANDATES, mandateById } from '@/lib/constants/mandates'
import QuestionsPageBody from '@/app/assembly/questions/QuestionsPageBody'

export function generateStaticParams() {
  return ALL_ARCHIVE_MANDATES.map((m) => ({ mandate: m.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ mandate: string }> }): Promise<Metadata> {
  const { mandate: id } = await params
  const m = mandateById(id)
  return {
    title: `MLA Questions - ${m?.label ?? id} archive`,
    description: `Questions tabled by MLAs during the ${m?.label ?? id} mandate.`,
  }
}

export default async function ArchiveQuestionsPage({ params }: { params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  if (!mandate) notFound()
  return <QuestionsPageBody mandate={mandate} basePath={`/archive/${id}`} />
}
