export const runtime = 'edge'

import { redirect } from 'next/navigation'

export default function VoteDetailLegacy({ params }: { params: { id: string } }) {
  redirect(`/assembly/divisions/${params.id}`)
}
