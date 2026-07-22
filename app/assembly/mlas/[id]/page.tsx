import type { Metadata } from 'next'
import { getMemberById, getAllMembersIncludingFormer } from '@/lib/db/queries'
import { CURRENT_MANDATE } from '@/lib/constants/mandates'
import MlaDetailPageBody from './MlaDetailPageBody'

export async function generateStaticParams() {
  const members = await getAllMembersIncludingFormer()
  return members.map(m => ({ id: m.personId }))
}

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const member = await getMemberById(id)
  if (!member) return { title: 'MLA not found' }
  const description = `Voting record, expenses and registered interests for ${member.fullName}${member.party ? `, ${member.party}` : ''}${member.constituency ? `, ${member.constituency}` : ''}.`
  return {
    title: member.fullName,
    description,
    openGraph: {
      title: `${member.fullName} — Stormont Watch`,
      description,
      images: [{ url: 'https://www.stormontwatch.com/opengraph-image-v2.png', width: 1200, height: 630, alt: 'Stormont Watch — NI Assembly Transparency' }],
    },
    twitter: {
      card: 'summary_large_image',
    },
    alternates: { canonical: `https://www.stormontwatch.com/assembly/mlas/${id}` },
  }
}

export default async function MlaDetailPage({ params }: Props) {
  const { id } = await params
  return <MlaDetailPageBody id={id} mandate={CURRENT_MANDATE} basePath="" />
}
