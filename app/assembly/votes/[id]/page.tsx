import { redirect } from 'next/navigation'

export const runtime = 'edge'

export default function VoteDetailLegacy({ params }: { params: { id: string } }) {
  redirect(`/assembly/divisions/${params.id}`)
}
