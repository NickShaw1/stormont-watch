import { redirect } from 'next/navigation'

export const revalidate = 86400
export const runtime = 'edge'

export default function VoteDetailLegacy({ params }: { params: { id: string } }) {
  redirect(`/assembly/bills/${params.id}`)
}
