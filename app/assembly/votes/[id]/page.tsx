export const runtime = 'edge'

import { redirect } from 'next/navigation'

export default async function VoteDetailLegacy({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/assembly/divisions/${id}`)
}
